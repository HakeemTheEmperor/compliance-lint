import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { Violation } from "@/src/engine/types";

interface CacheEntry {
  hash: string;
  violations: Violation[];
}

interface CacheStore {
  version: string;
  files: Record<string, CacheEntry>;
}

const CACHE_FILE_PATH = ".gdpr-cache.json";
const CACHE_VERSION = "1.0.0";

export class LinterCache {
  private store: CacheStore;
  private cacheFilePath: string;

  constructor(cachePath: string = CACHE_FILE_PATH) {
    this.cacheFilePath = cachePath;
    this.store = this.loadCache();
  }

  private loadCache(): CacheStore {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, "utf-8");
        const parsed = JSON.parse(raw) as CacheStore;
        if (parsed.version === CACHE_VERSION) {
          return parsed;
        }
      }
    } catch {
      // Fallback to fresh cache if corrupted
    }
    return { version: CACHE_VERSION, files: {} };
  }

  public getCachedViolations(
    filePath: string,
    content: string,
  ): Violation[] | null {
    const hash = crypto.createHash("md5").update(content).digest("hex");
    const entry = this.store.files[filePath];

    if (entry && entry.hash === hash) {
      return entry.violations;
    }
    return null;
  }

  public setCachedViolations(
    filePath: string,
    content: string,
    violations: Violation[],
  ): void {
    const hash = crypto.createHash("md5").update(content).digest("hex");
    this.store.files[filePath] = { hash, violations };
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
