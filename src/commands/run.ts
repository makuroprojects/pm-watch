import { ActivityWatchClient } from "../activitywatch";
import { Buffer } from "../buffer";
import { loadConfig } from "../config";
import { log } from "../log";
import { syncPending } from "../sync";
import { maybeAutoUpdate } from "../updater";
import { VERSION } from "../version";

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_STARTUP_GRACE_MS = 10 * 60 * 1000;

export async function runCommand(_args: string[]) {
  const config = await loadConfig();
  const buf = new Buffer();
  const aw = await ActivityWatchClient.create();

  log(
    `agent starting v${VERSION}`,
    `interval=${config.syncIntervalMinutes}min`,
    `webhook=${config.webhookUrl || "(unset)"}`,
    `autoUpdate=${config.autoUpdate}`,
  );

  const shutdown = () => {
    log("shutting down");
    buf.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const startTime = Date.now();
  let lastUpdateCheck = 0;

  while (true) {
    try {
      await tick(aw, buf);
    } catch (err) {
      log("tick error", String(err));
    }

    const now = Date.now();
    if (
      now - startTime > UPDATE_STARTUP_GRACE_MS &&
      now - lastUpdateCheck > UPDATE_CHECK_INTERVAL_MS
    ) {
      lastUpdateCheck = now;
      const applied = await maybeAutoUpdate({
        autoUpdate: config.autoUpdate,
        pendingCount: buf.stats().pending,
      });
      if (applied) {
        buf.close();
        process.exit(0);
      }
    }

    await new Promise((r) => setTimeout(r, config.syncIntervalMinutes * 60_000));
  }
}

async function tick(aw: ActivityWatchClient, buf: Buffer) {
  if (!(await aw.ping())) {
    log("ActivityWatch unreachable, skip tick");
    return;
  }

  const buckets = await aw.listBuckets();
  for (const bucket of buckets) {
    const cursor = buf.getCursor(bucket.id);
    const events = await aw.getEvents(bucket.id, {
      start: cursor ?? undefined,
      limit: 10000,
    });
    if (events.length === 0) continue;

    buf.insertEvents(bucket.id, events);
    const latest = events.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
    buf.setCursor(bucket.id, latest.timestamp);
    log(`fetched bucket=${bucket.id} count=${events.length}`);
  }

  const result = await syncPending(buf);
  if (result.sent > 0 || result.failed > 0) {
    log(`sync sent=${result.sent} failed=${result.failed}`);
  }
}
