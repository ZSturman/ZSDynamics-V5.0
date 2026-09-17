import * as fs from "fs";
import * as path from "path";

// Simple in-memory cache to avoid repeating expensive filesystem walks
// during the same server/process lifetime. Keyed by `subdir` so callers
// can request different roots (e.g. "projects"). We store a Promise so
// in-flight calls are deduped as well.
const _loadPublicJsonCache: Record<string, Promise<unknown[]> | undefined> = {};

export function clearLoadPublicJsonCache() {
  for (const k of Object.keys(_loadPublicJsonCache)) delete _loadPublicJsonCache[k];
}

/**
 * Recursively loads all .json files under /public/<subdir>
 * and returns a single typed array.
 * Files may contain a single object or an array.
 */
export async function loadPublicJsonRecursively<T = unknown>(
  subdir = "projects"
): Promise<T[]> {
  if (_loadPublicJsonCache[subdir]) {
    return _loadPublicJsonCache[subdir] as Promise<T[]>;
  }

  const primaryRoot = path.join(process.cwd(), "public", subdir);
  const fallbackRoots = [path.join(process.cwd(), "Projects"), path.join(process.cwd(), "PORTFOLIO")];
  const rootsToWalk: string[] = [];
  const out: T[] = [];
  const verbose = Boolean(process.env.LOAD_PUBLIC_JSON_VERBOSE || process.env.DEBUG);

  if (fs.existsSync(primaryRoot)) rootsToWalk.push(primaryRoot);
  for (const f of fallbackRoots) if (fs.existsSync(f)) rootsToWalk.push(f);
  if (rootsToWalk.length === 0) {
    if (verbose) console.warn(`No roots found for public/${subdir} or fallbacks; checked: ${[primaryRoot, ...fallbackRoots].join(", ")}`);
    // Still attempt to walk the primary (will surface an error later) to preserve behavior
    rootsToWalk.push(primaryRoot);
  }

  async function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (verbose) console.warn(`Skipping missing/unreadable directory ${dir}:`, err);
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name.endsWith(".json")) {
        try {
          const raw = await fs.promises.readFile(full, "utf8");
          const parsed = JSON.parse(raw);
          function shouldInclude(obj: unknown): { include: boolean; reason?: string } {
            // Returns include boolean and optional reason for skipping
            if (!(obj && typeof obj === "object")) return { include: false, reason: "not_an_object" };
            const o = obj as Record<string, unknown>;
            
            // For projects, require an `id` field
            if (subdir === "projects") {
              if (!Object.prototype.hasOwnProperty.call(o, "id") || !o["id"]) {
                return { include: false, reason: "missing_id" };
              }
            }
            
            if (Object.prototype.hasOwnProperty.call(o, "reviewed")) {
              const rev = o["reviewed"];
              if (rev === false || rev === "false") return { include: false, reason: "reviewed_false" };
            }
            if (Object.prototype.hasOwnProperty.call(o, "visibility")) {
              const vis = o["visibility"];
              if (vis !== "public") return { include: false, reason: `visibility_${String(vis)}` };
            }
            return { include: true };
          }
          if (Array.isArray(parsed)) {
            const arr = parsed as unknown[];
            for (const item of arr) {
              const res = shouldInclude(item);
              if (res.include) out.push(item as T);
              else if (verbose) console.debug(`Skipped item in ${full}: ${res.reason}`);
            }
          } else {
            const res = shouldInclude(parsed);
            if (res.include) out.push(parsed as T);
            else if (verbose) console.debug(`Skipped ${full}: ${res.reason}`);
          }
        } catch (err) {
          console.warn(`Skipping ${full}:`, err instanceof Error ? err.message : err);
        }
      }
    }
  }
  // Wrap the actual work in an IIFE and save the Promise into the cache so
  // concurrent callers share the same work and later callers get the cached
  // result.
  const work = (async () => {
    // Walk all candidate roots
    for (const r of rootsToWalk) {
      if (verbose) console.info(`Walking JSON root: ${r}`);
      await walk(r);
    }
    return out;
  })();

  _loadPublicJsonCache[subdir] = work as Promise<unknown[]>;
  return work as Promise<T[]>;
}
