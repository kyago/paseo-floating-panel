import { useColorScheme } from "react-native";

/**
 * The floating root sits outside Paseo's tree, so it cannot receive `theme`. Paseo's Unistyles puts the
 * active theme (built-in or plugin-contributed) on :root as CSS variables, and react-native-web passes
 * `var(...)` colours through, so the panel follows theme changes live. The hex values are fallbacks
 * for a Paseo that stops exposing these variables.
 */
const palettes = {
  dark: {
    surface: "var(--colors-surface0, #1e1e22)",
    raised: "var(--colors-surface2, #2a2a30)",
    border: "var(--colors-border, #3a3a42)",
    foreground: "var(--colors-foreground, #ececf1)",
    muted: "var(--colors-foreground-muted, #a1a1aa)",
    accent: "var(--colors-accent, #5b8def)",
    accentForeground: "var(--colors-accent-foreground, #ffffff)",
    warning: "var(--colors-status-warning, #f59e0b)",
    danger: "var(--colors-status-danger, #ef4444)",
    success: "var(--colors-status-success, #22c55e)",
  },
  light: {
    surface: "var(--colors-surface0, #ffffff)",
    raised: "var(--colors-surface2, #f4f4f5)",
    border: "var(--colors-border, #e4e4e7)",
    foreground: "var(--colors-foreground, #18181b)",
    muted: "var(--colors-foreground-muted, #71717a)",
    accent: "var(--colors-accent, #2563eb)",
    accentForeground: "var(--colors-accent-foreground, #ffffff)",
    warning: "var(--colors-status-warning, #d97706)",
    danger: "var(--colors-status-danger, #dc2626)",
    success: "var(--colors-status-success, #16a34a)",
  },
};

export type Palette = typeof palettes.dark;

export const usePalette = (): Palette =>
  palettes[useColorScheme() === "light" ? "light" : "dark"];
