import * as fs from "fs";
import * as path from "path";
import { validateQuarantinePath } from "./validator";

/**
 * Quarantine writer — ensures private quarantine paths are safe and excluded from app bundles/Git
 * per .gitignore content/quarantine/. Never logs protected source data.
 */

export interface QuarantineWriter {
  write(quarantinePath: string, buffer: Buffer): Promise<void>;
  exists(quarantinePath: string): Promise<boolean>;
  read(quarantinePath: string): Promise<Buffer | null>;
}

export class FileQuarantineWriter implements QuarantineWriter {
  constructor(private readonly baseDir: string = process.cwd()) {}

  private resolveSafe(quarantinePath: string): string {
    validateQuarantinePath(quarantinePath);
    const full = path.join(this.baseDir, quarantinePath);
    const normalized = path.normalize(full);
    const baseNormalized = path.normalize(path.join(this.baseDir, "content/quarantine"));
    if (!normalized.startsWith(baseNormalized)) {
      throw Object.assign(new Error(`Quarantine path escapes base: ${quarantinePath}`), { code: "path-traversal" });
    }
    return normalized;
  }

  async write(quarantinePath: string, buffer: Buffer): Promise<void> {
    const full = this.resolveSafe(quarantinePath);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, buffer);
  }

  async exists(quarantinePath: string): Promise<boolean> {
    const full = this.resolveSafe(quarantinePath);
    try {
      await fs.promises.access(full, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async read(quarantinePath: string): Promise<Buffer | null> {
    const full = this.resolveSafe(quarantinePath);
    try {
      return await fs.promises.readFile(full);
    } catch {
      return null;
    }
  }
}

/**
 * In-memory quarantine for tests — no filesystem, deterministic, no mutation on unauthorized.
 */
export class InMemoryQuarantineWriter implements QuarantineWriter {
  private store = new Map<string, Buffer>();
  public writes: { path: string; size: number }[] = [];

  async write(quarantinePath: string, buffer: Buffer): Promise<void> {
    validateQuarantinePath(quarantinePath);
    this.store.set(quarantinePath, Buffer.from(buffer));
    this.writes.push({ path: quarantinePath, size: buffer.length });
  }

  async exists(quarantinePath: string): Promise<boolean> {
    return this.store.has(quarantinePath);
  }

  async read(quarantinePath: string): Promise<Buffer | null> {
    return this.store.get(quarantinePath) ?? null;
  }

  getWriteCount(): number {
    return this.writes.length;
  }

  reset(): void {
    this.store.clear();
    this.writes = [];
  }
}
