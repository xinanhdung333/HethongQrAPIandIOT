export const USED_MAP_TTL_DAYS = 30;

const USED_MAP_TTL_MS = USED_MAP_TTL_DAYS * 24 * 60 * 60 * 1000;

export type UsedMap = Record<string, string>;

export function pruneUsedMap(used: UsedMap, now = Date.now()) {
  return Object.fromEntries(
    Object.entries(used).filter(([, usedAt]) => {
      const timestamp = new Date(usedAt).getTime();
      return Number.isFinite(timestamp) && now - timestamp <= USED_MAP_TTL_MS;
    })
  );
}

export function readPrunedUsedMap(storageKey: string) {
  const used = pruneUsedMap(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as UsedMap);
  window.localStorage.setItem(storageKey, JSON.stringify(used));
  return used;
}
