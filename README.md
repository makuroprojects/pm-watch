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
pmw get [key]                Show config (all keys or one)
pmw unset token              Remove token from Keychain

pmw install                  Install LaunchAgent (auto-start at login)
pmw start | stop | restart   Control running agent
pmw uninstall [--purge]      Remove LaunchAgent (add --purge to drop token)

pmw status                   Show status (state, Agent ID, config summary)
pmw doctor                   Run all health checks
pmw sync                     Force a sync now
pmw logs [-f] [-n N]         Tail agent log
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

## Paths

| | |
|---|---|
| Binary | `~/.local/bin/pmw` |
| Config | `~/Library/Application Support/pm-watch/config.json` |
| Buffer (SQLite) | `~/Library/Application Support/pm-watch/buffer.db` |
| Log | `~/Library/Logs/pm-watch/agent.log` |
| LaunchAgent plist | `~/Library/LaunchAgents/com.pmwatch.agent.plist` |
| Keychain entry | service `pm-watch`, account `webhook-token` |

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

Tag a version and publish both arch binaries as release assets:

```bash
bun run build && bun run build:x64
git tag vX.Y.Z && git push origin vX.Y.Z
gh release create vX.Y.Z \
  --prerelease \
  --title "pm-watch vX.Y.Z" \
  --notes "..." \
  dist/pmw-darwin-arm64 dist/pmw-darwin-x64
```

The installer resolves the newest release via the GitHub releases API, so pre-releases are picked up automatically.

## Notes

- macOS distribution is **unsigned** — the installer uses `xattr -cr` to clear the quarantine attribute set by Gatekeeper. This works because we download over HTTPS and the user explicitly opts in; there is no Apple Developer ID involved.
- Windows and Linux are not supported.
