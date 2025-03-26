export function getKeyFromValue<T, K>(map: Map<K, T>, value: T): K | undefined {
    for (const [key, val] of map.entries()) {
      if (val === value) {
        return key;
      }
    }
    return undefined;
}