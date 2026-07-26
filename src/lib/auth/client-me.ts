/**
 * Dedupes concurrent / short-lived /api/auth/me (and field me) fetches so
 * portal bridge + shell do not pay two serial RTTs for the same session.
 */

type MeJson = {
  success: boolean;
  data?: { name?: string; role?: string; [key: string]: unknown };
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; json: MeJson }>();
const inflight = new Map<string, Promise<MeJson>>();

export function fetchClientMe(url: string): Promise<MeJson> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return Promise.resolve(hit.json);
  }
  const pending = inflight.get(url);
  if (pending) return pending;

  const p = fetch(url)
    .then((r) => r.json() as Promise<MeJson>)
    .then((json) => {
      cache.set(url, { at: Date.now(), json });
      return json;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, p);
  return p;
}

/** Clear after logout so the next login cannot reuse a stale me payload. */
export function clearClientMeCache() {
  cache.clear();
  inflight.clear();
}
