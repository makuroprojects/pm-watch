# pm-watch

CLI agent that syncs [ActivityWatch](https://activitywatch.net) events from macOS to a remote webhook (e.g. `pm-dashboard`). Runs silently in the background via `launchd`, buffers events locally in SQLite, and is claimed by users in the dashboard after install.

## Requirements

- macOS (Apple Silicon or Intel)
- [ActivityWatch](https://activitywatch.net) installed and running locally (default: `http://localhost:5600`)
- Network access to your webhook endpoint

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/makuroprojects/pm-watch/main/installer/install.sh | bash
source ~/.zshrc
```

The installer:

- Detects architecture (`arm64` / `x64`) and downloads the matching binary from GitHub Releases
- Places `pmw` in `~/.local/bin/` (no `sudo` required)
- Clears macOS quarantine on the binary
- Ensures `~/.local/bin` is on `PATH` via `~/.zshrc` / `~/.bashrc`

## Quick start

```bash
pmw init     # interactive wizard: webhook URL, token, dashboard URL, interval
pmw pair     # prints the Agent ID — paste into pm-dashboard to claim
pmw status   # running state, buffer, Agent ID
```

After `init` the agent runs in the background on every login (via LaunchAgent) and restarts automatically if it crashes.

## Commands

```
pmw init                     Interactive setup wizard
pmw pair                     Show Agent ID + claim instructions
pmw set hook <url>           Webhook URL
pmw set dashboard <url>      Dashboard URL (shown on pmw pair)
pmw set token                Auth token (prompt or --stdin)
pmw set interval <n>         Sync interval in minutes
pmw set autoUpdate on|off    Enable/disable auto-update (default on)
pmw get [key]                Show config (all keys or one)
pmw unset token              Remove token from Keychain

pmw install                  Install LaunchAgent (auto-start at login)
pmw start | stop | restart   Control running agent
pmw uninstall [--purge]      Remove LaunchAgent (add --purge to drop token)

pmw status                   Show status (state, Agent ID, version, config)
pmw doctor                   Run all health checks
pmw sync                     Force a sync now
pmw logs [-f] [-n N]         Tail agent log
pmw update [--check]         Update to latest release (--check = dry run)
pmw --version                Print version
```

## How it works

```
┌── Mac (each user) ────────────────────────────────┐
│  ActivityWatch  ──►  pmw (LaunchAgent background) │
│                       │ poll every N min          │
│                       │ buffer in bun:sqlite      │
│                       ▼                           │
│                  POST to webhookUrl ──────────────┼──► pm-dashboard
│                  Bearer <token>                   │
│                  { agent_id, hostname, events }   │
└───────────────────────────────────────────────────┘
```

- **Agent identity** — a UUID v4 is generated on first run and persisted in `config.json`. Every sync payload includes `agent_id`, `hostname`, `os_user` so the dashboard can attribute events to a claimed user.
- **Buffering** — events live in `bun:sqlite` with a per-bucket cursor. If the webhook is down, data accumulates locally and is retried on the next tick. `INSERT OR IGNORE` on `(bucket_id, event_id)` prevents duplicates on re-fetch.
- **Claim flow** — fresh agents ship anonymous. User opens `pm-dashboard`, pastes the Agent ID from `pmw pair`, and an admin approves. Post-approval, the dashboard routes events from that `agent_id` to the claiming user.
- **Secrets** — the auth token lives in the macOS Keychain (`security` CLI). Never stored in plain `config.json`.
- **Auto-update** — once a day the run loop checks GitHub Releases. If a newer tag exists and the local buffer backlog is manageable, it downloads the matching binary, atomically swaps `~/.local/bin/pmw`, and exits so the LaunchAgent restarts on the new version. Disable with `pmw set autoUpdate off`. The first 10 minutes after a restart skip the check to prevent update-restart loops if a release is bad.

## Webhook payload

Every sync posts a single JSON body to `webhookUrl` with `Authorization: Bearer <token>`. Batches cap at 500 events; the agent retries on failure and uses `(bucket_id, event_id)` for idempotency on the receiver side.

```http
POST /webhooks/aw HTTP/1.1
Host: pm-dashboard.corp.com
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "agent_id": "76e52ea6-2196-49a0-befd-34486dcc9e2d",
  "hostname": "air-malik",
  "os_user": "bip",
  "events": [
    {
      "bucket_id": "aw-watcher-window_air-malik",
      "event_id": 10421,
      "timestamp": "2026-04-17T08:14:22.481Z",
      "duration": 12.5,
      "data": {
        "app": "Code",
        "title": "pm-watch — README.md"
      }
    },
    {
      "bucket_id": "aw-watcher-afk_air-malik",
      "event_id": 8823,
      "timestamp": "2026-04-17T08:14:35.002Z",
      "duration": 60,
      "data": {
        "status": "not-afk"
      }
    },
    {
      "bucket_id": "aw-watcher-web-chrome",
      "event_id": 4571,
      "timestamp": "2026-04-17T08:15:07.119Z",
      "duration": 4.2,
      "data": {
        "url": "https://github.com/makuroprojects/pm-watch",
        "title": "makuroprojects/pm-watch",
        "audible": false,
        "incognito": false,
        "tabCount": 7
      }
    }
  ]
}
```

Fields:

| Field         | Source                                           |
| ------------- | ------------------------------------------------ |
| `agent_id`    | UUID v4 generated on first run, immutable        |
| `hostname`    | `os.hostname()`                                  |
| `os_user`     | `os.userInfo().username`                         |
| `bucket_id`   | ActivityWatch bucket name (e.g. `aw-watcher-*`)  |
| `event_id`    | ActivityWatch event primary key within bucket    |
| `timestamp`   | ISO 8601 UTC from ActivityWatch                  |
| `duration`    | Seconds                                          |
| `data`        | Raw watcher payload (schema depends on watcher)  |

The server should respond `2xx` on success; on `4xx/5xx` the agent keeps events pending and retries next tick. Typical watchers you will see in `bucket_id`: `aw-watcher-window_<host>` (active window), `aw-watcher-afk_<host>` (idle state), `aw-watcher-web-*` (browser URL).

## Paths

|                   |                                                      |
| ----------------- | ---------------------------------------------------- |
| Binary            | `~/.local/bin/pmw`                                   |
| Config            | `~/Library/Application Support/pm-watch/config.json` |
| Buffer (SQLite)   | `~/Library/Application Support/pm-watch/buffer.db`   |
| Log               | `~/Library/Logs/pm-watch/agent.log`                  |
| LaunchAgent plist | `~/Library/LaunchAgents/com.pmwatch.agent.plist`     |
| Keychain entry    | service `pm-watch`, account `webhook-token`          |

## Updating

```bash
pmw update              # check + download + restart LaunchAgent
pmw update --check      # dry run: just report if newer tag exists
pmw update --force      # reinstall current tag (useful if binary got corrupted)
```

If `autoUpdate` is on (default), the background agent also updates itself once a day. Manual `pmw update` is always available regardless of that flag.

## Uninstall

```bash
pmw uninstall --purge            # stop agent, remove plist + Keychain token
rm -rf ~/Library/Application\ Support/pm-watch   # also drop config + buffer
rm -rf ~/Library/Logs/pm-watch                   # also drop logs
rm ~/.local/bin/pmw                              # also drop binary
```

## Build from source

Requires [Bun](https://bun.sh) installed locally (only for building).

```bash
bun install
bun run build        # dist/pmw-darwin-arm64
bun run build:x64    # dist/pmw-darwin-x64
```

## Release

Bump `VERSION` in `src/version.ts`, then tag a version and publish both arch binaries as release assets:

```bash
# 1. bump src/version.ts → commit
# 2. build both arches (VERSION is baked into each binary)
bun run build && bun run build:x64
git tag vX.Y.Z && git push origin vX.Y.Z
gh release create vX.Y.Z \
  --prerelease \
  --title "pm-watch vX.Y.Z" \
  --notes "..." \
  dist/pmw-darwin-arm64 dist/pmw-darwin-x64
```

The installer resolves the newest release via the GitHub releases API, so pre-releases are picked up automatically. Installed agents with `autoUpdate: true` will pick up the new version within 24h without any user action.

## Notes

- macOS distribution is **unsigned** — the installer uses `xattr -cr` to clear the quarantine attribute set by Gatekeeper. This works because we download over HTTPS and the user explicitly opts in; there is no Apple Developer ID involved.
- Windows and Linux are not supported.
