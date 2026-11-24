import * as SecureStore from "expo-secure-store";

// The Where sheet's recents (user, 2026-11-23): the last areas picked and venues opened from it,
// newest first, kept on the phone. SecureStore is the store the app already has (no new native
// module); a value should stay under 2 KB, and five short entries do.

export type RecentSearch =
  | { kind: "area"; id: string; name: string; within: string | null }
  | { kind: "venue"; slug: string; name: string; line: string | null };

const KEY = "search.recents";
const MAX = 5;

const keyOf = (recent: RecentSearch) =>
  recent.kind === "area" ? `area:${recent.id}` : `venue:${recent.slug}`;

export function recentSearches(): RecentSearch[] {
  try {
    const stored = JSON.parse(SecureStore.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(stored) ? (stored as RecentSearch[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

// To the top; picked again, it moves up rather than showing twice.
export function rememberSearch(recent: RecentSearch) {
  const rest = recentSearches().filter((each) => keyOf(each) !== keyOf(recent));
  SecureStore.setItem(KEY, JSON.stringify([recent, ...rest].slice(0, MAX)));
}

export function clearRecentSearches() {
  void SecureStore.deleteItemAsync(KEY);
}
