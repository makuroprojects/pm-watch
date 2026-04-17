import type { Buffer } from "./buffer";
import { loadConfig } from "./config";
import { getToken } from "./keychain";
import { log } from "./log";

export interface SyncResult {
  sent: number;
  failed: number;
  reason?: string;
}

export async function syncPending(buf: Buffer): Promise<SyncResult> {
  const config = await loadConfig();
  if (!config.webhookUrl) {
    return { sent: 0, failed: 0, reason: "webhookUrl not configured" };
  }

  const token = await getToken();
  const batch = buf.getPendingBatch(500);
  if (batch.length === 0) return { sent: 0, failed: 0 };

  const payload = {
    events: batch.map((e) => ({
      bucket_id: e.bucket_id,
      event_id: e.event_id,
      timestamp: e.timestamp,
      duration: e.duration,
      data: JSON.parse(e.data),
    })),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log("sync failed", res.status, body);
      return { sent: 0, failed: batch.length, reason: `HTTP ${res.status}` };
    }
    buf.markSynced(batch.map((e) => e.id));
    return { sent: batch.length, failed: 0 };
  } catch (err) {
    log("sync error", String(err));
    return { sent: 0, failed: batch.length, reason: String(err) };
  }
}
