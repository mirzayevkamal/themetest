/** A multilanguage setting arrives as the current-locale string or as `{ ar, en }`. */
export function localizedSetting(value: unknown, locale: string): string {
  const text =
    value && typeof value === 'object' ? (value as Record<string, unknown>)[locale] : value;
  return typeof text === 'string' ? text.trim() : '';
}
