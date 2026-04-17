# pm-watch

macOS-only CLI agent that polls ActivityWatch (`localhost:5600`) and POSTs events to a user-configured webhook. Distributed as a `bun --compile`'d single binary and registered as a LaunchAgent for background sync.

## Architecture

```
src/
  agent.ts           # CLI entry + subcommand router
  config.ts          # Config shape, paths, load/save, auto-gen agentId
  keychain.ts        # macOS `security` CLI wrapper for Bearer token
  launchctl.ts       # bootstrap/bootout/kickstart + plist template
  identity.ts        # hostname / os_user helpers
  activitywatch.ts   # ActivityWatch REST client (ping, listBuckets, getEvents)
  buffer.ts          # bun:sqlite — events + per-bucket cursors
  sync.ts            # POST batch to webhookUrl with Bearer token + identity
  log.ts             # append-only log to ~/Library/Logs/pm-watch/agent.log
  commands/
    init.ts          # @clack/prompts wizard
    pair.ts          # print Agent ID + claim instructions
    config.ts        # set / get / unset (KEY_ALIAS maps hook→webhookUrl etc.)
    install.ts       # write LaunchAgent plist + launchctl bootstrap
    uninstall.ts     # bootout + remove plist; --purge also drops Keychain token
    lifecycle.ts     # start / stop / restart via launchctl
    doctor.ts        # run all health checks
    status.ts        # colored status summary
    logs.ts          # tail / tail -f agent log
    run.ts           # poll-buffer-sync loop (LaunchAgent entrypoint, hidden)
    sync.ts          # force-sync command wrapper

installer/
  install.sh         # per-user curl installer (resolves latest via API)
  build.sh           # bun build --compile per ARCH, keeps both binaries
```

Key invariants:
- `agentId` is generated once in `loadConfig()` and **never** mutated afterwards. It is the stable identity for the claim flow.
- The auth token lives **only** in the macOS Keychain (service `pm-watch`, account `webhook-token`). Never write it to `config.json`.
- `buffer.db` dedupes events via `UNIQUE(bucket_id, event_id)`, so re-fetching from ActivityWatch is safe.
- Run-loop (`pmw run`) and LaunchAgent are coupled: the plist points at `~/.local/bin/pmw run`. `install.ts` rewrites the plist from a template in `launchctl.ts`.

## Commands to know

```bash
bun run dev         # bun run src/agent.ts
bun run build       # → dist/pmw-darwin-arm64
bun run build:x64   # → dist/pmw-darwin-x64
```

Smoke test without installing:

```bash
bun run dev status
bun run dev pair
bun run dev doctor
```

Smoke test the compiled binary locally (no release needed):

```bash
bun run build
~/.local/bin/pmw doctor     # after 'bash installer/install.sh' points at dist
```

## Release workflow

1. Bump: `git commit` with source changes, push `main`.
2. Build both architectures: `bun run build && bun run build:x64`.
3. Tag + push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. Publish: `gh release create vX.Y.Z --prerelease --notes-file ... dist/pmw-darwin-arm64 dist/pmw-darwin-x64`.

`installer/install.sh` queries `/repos/.../releases` (not `/releases/latest`) so **pre-releases are discoverable**. Keep releases `--prerelease` while pm-dashboard integration is in flight.

## Constraints and gotchas

- **No Apple Developer ID.** Distribution relies on `xattr -cr` to strip `com.apple.quarantine` after the installer downloads the binary. Any refactor that drops that step will reintroduce the "developer cannot be verified" Gatekeeper popup.
- **Per-user install, no `sudo`.** Binary goes to `~/.local/bin/pmw`, LaunchAgent is per-user (`gui/$UID`). Never switch to `/usr/local/bin` or `LaunchDaemons` — that would require root and break Keychain access.
- **macOS Library paths** are not writable in the default Claude Code sandbox. When running agent commands during dev, expect EPERM on `mkdir ~/Library/Application Support/pm-watch` unless sandbox is disabled for that call.
- **Raw GitHub CDN caches `~5 min`.** After pushing `installer/install.sh`, expect a short window before `curl | bash` picks up the change.
- `bun:sqlite` writes use `PRAGMA journal_mode = WAL`, so the DB directory contains `buffer.db`, `buffer.db-wal`, and `buffer.db-shm`. Clean up all three when resetting state.

## Bun conventions

Default to Bun APIs over Node equivalents:

- `bun` CLI instead of `node` / `ts-node`
- `bun test` instead of `jest` / `vitest`
- `bun install` / `bun add` / `bun run` instead of npm/yarn/pnpm
- `bunx` instead of `npx`
- `Bun.file`, `Bun.write`, `Bun.stdin` instead of `node:fs` readFile/writeFile
- `bun:sqlite` instead of `better-sqlite3`
- `Bun.$` shell template instead of `execa` / manual `spawn`
- `fetch` (Bun built-in) instead of `axios` / `node-fetch`
- `crypto.randomUUID()` (Web Crypto, built-in) instead of `uuid` package
- Bun auto-loads `.env` — do not pull in `dotenv`

The compiled binary embeds the Bun runtime, so target Macs do **not** need Bun installed. Only the build host does.
