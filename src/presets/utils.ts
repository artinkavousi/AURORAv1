export function pick<T extends Record<string, unknown>>(source: T, keys: readonly string[]): Partial<T> {
  const result: Partial<T> = {};
  keys.forEach((key) => {
    if (key in source) {
      (result as Record<string, unknown>)[key] = source[key];
    }
  });
  return result;
}

export function clonePreset<T extends Record<string, unknown>>(preset: T): T {
  return JSON.parse(JSON.stringify(preset)) as T;
}
