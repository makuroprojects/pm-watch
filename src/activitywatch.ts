import { loadConfig } from "./config";

export interface AwBucket {
  id: string;
  name?: string;
  type: string;
  client: string;
  hostname: string;
  created: string;
  last_updated?: string;
}

export interface AwEvent {
  id?: number;
  timestamp: string;
  duration: number;
  data: Record<string, unknown>;
}

export class ActivityWatchClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  static async create(): Promise<ActivityWatchClient> {
    const config = await loadConfig();
    return new ActivityWatchClient(config.awUrl);
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/0/info`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listBuckets(): Promise<AwBucket[]> {
    const res = await fetch(`${this.baseUrl}/api/0/buckets/`);
    if (!res.ok) throw new Error(`AW buckets: ${res.status}`);
    const data = (await res.json()) as Record<string, AwBucket>;
    return Object.values(data);
  }

  async getEvents(
    bucketId: string,
    opts: { start?: string; end?: string; limit?: number } = {},
  ): Promise<AwEvent[]> {
    const params = new URLSearchParams();
    if (opts.start) params.set("start", opts.start);
    if (opts.end) params.set("end", opts.end);
    if (opts.limit) params.set("limit", String(opts.limit));
    const url = `${this.baseUrl}/api/0/buckets/${encodeURIComponent(bucketId)}/events?${params}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`AW events ${bucketId}: ${res.status}`);
    return (await res.json()) as AwEvent[];
  }
}
