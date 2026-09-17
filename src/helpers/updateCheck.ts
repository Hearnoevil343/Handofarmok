/**
 * Is there a newer release than this build?
 *
 * Asks GitHub for the latest published release of this repository and compares
 * its tag with the version baked in at build time (`__APP_VERSION__`, from
 * package.json). Anything that goes wrong — offline, rate-limited (GitHub allows
 * 60 unauthenticated requests an hour per address), GitHub down — resolves to
 * null, so a failed check never gets in anyone's way.
 *
 * Only builds that contain this file can be told about updates; older builds
 * never check.
 */

const REPO = "Hearnoevil343/Handofarmok";
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

export const CURRENT_VERSION: string = __APP_VERSION__;

export type LatestRelease = { version: string; name: string; url: string };

/** "v0.2.10" -> [0, 2, 10]. A pre-release suffix ("-beta.1") is ignored. */
export function parseVersion(v: string): number[] {
  return v
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]
    .split(".")
    .map((part) => parseInt(part, 10) || 0);
}

/** Positive when `a` is newer than `b`, negative when older, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export async function fetchLatestRelease(signal?: AbortSignal): Promise<LatestRelease | null> {
  try {
    const res = await fetch(RELEASES_API, {
      signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return null;
    const { tag_name, name, html_url } = data as Record<string, unknown>;
    if (typeof tag_name !== "string") return null;
    // Only ever send people to this repository's own release pages.
    const url =
      typeof html_url === "string" && html_url.startsWith(`https://github.com/${REPO}/releases/`)
        ? html_url
        : RELEASES_PAGE;
    return {
      version: tag_name.replace(/^v/i, ""),
      name: typeof name === "string" && name ? name : tag_name,
      url,
    };
  } catch {
    return null;
  }
}

/** The newer release, or null when up to date or the check could not be made. */
export async function checkForUpdate(signal?: AbortSignal): Promise<LatestRelease | null> {
  const latest = await fetchLatestRelease(signal);
  return latest && compareVersions(latest.version, CURRENT_VERSION) > 0 ? latest : null;
}

// "Skip this version" is remembered per browser (or per .exe install). Storage
// can be unavailable, in which case the notice simply shows again next launch.
const SKIP_KEY = "hand-of-armok:skipped-update";

export function isSkipped(version: string): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === version;
  } catch {
    return false;
  }
}

export function skipVersion(version: string): void {
  try {
    localStorage.setItem(SKIP_KEY, version);
  } catch {
    // nothing to do: the reminder will return next launch
  }
}
