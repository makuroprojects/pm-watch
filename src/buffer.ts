import { Database } from "bun:sqlite";
import { DB_FILE, ensureDirs } from "./config";
import type { AwEvent } from "./activitywatch";

export interface BufferedEvent {
  id: number;
  bucket_id: string;
  event_id: number;
  timestamp: string;
  duration: number;
  data: string;
  synced: number;
  created_at: string;
}

export class Buffer {
  private db: Database;

  constructor() {
    ensureDirs();
    this.db = new Database(DB_FILE);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bucket_id TEXT NOT NULL,
        event_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        duration REAL NOT NULL,
        data TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(bucket_id, event_id)
      );
      CREATE INDEX IF NOT EXISTS idx_events_synced ON events(synced);
      CREATE INDEX IF NOT EXISTS idx_events_bucket_ts ON events(bucket_id, timestamp);

      CREATE TABLE IF NOT EXISTS cursors (
        bucket_id TEXT PRIMARY KEY,
        last_timestamp TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  insertEvents(bucketId: string, events: AwEvent[]) {
    const stmt = this.db.prepare(
      "INSERT OR IGNORE INTO events (bucket_id, event_id, timestamp, duration, data) VALUES (?, ?, ?, ?, ?)",
    );
    const tx = this.db.transaction((rows: AwEvent[]) => {
      for (const e of rows) {
        if (e.id == null) continue;
        stmt.run(bucketId, e.id, e.timestamp, e.duration, JSON.stringify(e.data));
      }
    });
    tx(events);
  }

  getCursor(bucketId: string): string | null {
    const row = this.db
      .prepare("SELECT last_timestamp FROM cursors WHERE bucket_id = ?")
      .get(bucketId) as { last_timestamp: string } | null;
    return row?.last_timestamp ?? null;
  }

  setCursor(bucketId: string, timestamp: string) {
    this.db
      .prepare(
        `INSERT INTO cursors (bucket_id, last_timestamp) VALUES (?, ?)
         ON CONFLICT(bucket_id) DO UPDATE SET last_timestamp = excluded.last_timestamp, updated_at = datetime('now')`,
      )
      .run(bucketId, timestamp);
  }

  getPendingBatch(limit = 500): BufferedEvent[] {
    return this.db
      .prepare("SELECT * FROM events WHERE synced = 0 ORDER BY id LIMIT ?")
      .all(limit) as BufferedEvent[];
  }

  markSynced(ids: number[]) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(",");
    this.db
      .prepare(`UPDATE events SET synced = 1 WHERE id IN (${placeholders})`)
      .run(...ids);
  }

  stats() {
    const total = (this.db.prepare("SELECT COUNT(*) as n FROM events").get() as { n: number }).n;
    const pending = (
      this.db.prepare("SELECT COUNT(*) as n FROM events WHERE synced = 0").get() as { n: number }
    ).n;
    return { total, pending };
  }

  close() {
    this.db.close();
  }
}
