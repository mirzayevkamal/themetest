import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';

/**
 * The merchant's `accent_style`: `soft` (brand-coloured text on a faint tint) or
 * `outlined` (brand border or underline around ink text). Drives the card "+" tile
 * and the active category tab and sub-category chip.
 */
export function useAccentOutlined(): boolean {
  return useThemeSettings()?.accent_style === 'outlined';
}

/** `primary_button_style: dark` turns the filled call-to-action buttons ink. */
export function useDarkButtons(): boolean {
  return useThemeSettings()?.primary_button_style === 'dark';
}

/** Theme-specific twilight.json keys the engine's ThemeSettings type doesn't list. */
export function useThemeSettings() {
  return useTwilight().theme?.settings as Record<string, unknown> | undefined;
}
