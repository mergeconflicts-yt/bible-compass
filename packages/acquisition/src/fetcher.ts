import type { FetchResult } from "./types";

/**
 * Fetcher interface — production uses http fetch with streaming, tests use local fixtures.
 * No network in CI: tests provide a FixtureFetcher.
 */
export interface Fetcher {
  fetch(url: string): Promise<FetchResult>;
}

/**
 * FixtureFetcher for local tests — no network, deterministic.
 * Map url -> { buffer, mediaType }
 */
export class FixtureFetcher implements Fetcher {
  private fixtures = new Map<string, { buffer: Buffer; mediaType: string }>();
  private fetchCount = 0;
  private fetchedUrls: string[] = [];

  setFixture(url: string, buffer: Buffer, mediaType: string): void {
    this.fixtures.set(url, { buffer, mediaType });
  }

  setFixtureFromString(
    url: string,
    content: string,
    mediaType = "text/plain",
  ): void {
    this.fixtures.set(url, {
      buffer: Buffer.from(content, "utf-8"),
      mediaType,
    });
  }

  async fetch(url: string): Promise<FetchResult> {
    this.fetchCount++;
    this.fetchedUrls.push(url);
    const entry = this.fixtures.get(url);
    if (!entry) {
      throw Object.assign(new Error(`Fixture not found for URL: ${url}`), {
        code: "fixture-not-found",
      });
    }
    return {
      buffer: entry.buffer,
      mediaType: entry.mediaType,
      byteSize: entry.buffer.length,
      finalUrl: url,
      redirects: 0,
    };
  }

  getFetchCount(): number {
    return this.fetchCount;
  }

  getFetchedUrls(): string[] {
    return [...this.fetchedUrls];
  }

  reset(): void {
    this.fetchCount = 0;
    this.fetchedUrls = [];
  }
}

/**
 * HttpFetcher for production — not used in CI tests.
 * Would enforce timeout, redirect policy, maxByteSize streaming.
 * Kept minimal here to avoid network in tests; real implementation would use undici/fetch with AbortController.
 */
export class HttpFetcher implements Fetcher {
  constructor(
    private readonly allowedHosts: string[],
    private readonly timeoutMs: number,
    private readonly maxRedirects: number,
  ) {}

  async fetch(url: string): Promise<FetchResult> {
    // Placeholder: in production this would use fetch with timeout and redirect checks
    // For now, throw to ensure tests do not accidentally use network
    throw Object.assign(
      new Error(
        "HttpFetcher not available in test environment — use FixtureFetcher",
      ),
      {
        code: "network-disabled-in-test",
      },
    );
  }
}
