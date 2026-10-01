import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { Violation } from "@/src/engine/types";

interface CacheEntry {
  hash: string;
  violations: Violation[];
}

interface CacheStore {
  version: string;
  fingerprint: string;
  files: Record<string, CacheEntry>;
}

const CACHE_FILE_PATH = ".gdpr-cache.json";
const CACHE_VERSION = "2";

export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Content-hash cache. The `fingerprint` captures everything other than the
 * file content that affects results (tool version, rule set, config); when it
 * changes the whole cache is discarded.
 */
export class LinterCache {
  private store: CacheStore;
  private cacheFilePath: string;
  private fingerprint: string;

  constructor(cachePath: string = CACHE_FILE_PATH, fingerprint: string = "") {
    this.cacheFilePath = cachePath;
    this.fingerprint = fingerprint;
    this.store = this.loadCache();
  }

  private emptyStore(): CacheStore {
    return { version: CACHE_VERSION, fingerprint: this.fingerprint, files: {} };
  }

  private loadCache(): CacheStore {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, "utf-8");
        const parsed = JSON.parse(raw) as CacheStore;
        if (
          parsed.version === CACHE_VERSION &&
          parsed.fingerprint === this.fingerprint
        ) {
          return parsed;
        }
      }
    } catch {
      // Fallback to fresh cache if corrupted
    }
    return this.emptyStore();
  }

  public getCachedViolations(
    filePath: string,
    content: string,
  ): Violation[] | null {
    const entry = this.store.files[filePath];

    if (entry && entry.hash === hashContent(content)) {
      return entry.violations;
    }
    return null;
  }

  public setCachedViolations(
    filePath: string,
    content: string,
    violations: Violation[],
  ): void {
    this.store.files[filePath] = { hash: hashContent(content), violations };
  }

  public saveCache(): void {
    try {
      fs.writeFileSync(
        this.cacheFilePath,
        JSON.stringify(this.store, null, 2),
        "utf-8",
      );
    } catch (err) {
      console.error("Failed to persist linter cache:", err);
    }
  }
}
