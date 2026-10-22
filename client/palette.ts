import { useColorScheme } from "react-native";

// ponytail: follows the OS colour scheme, not Paseo's theme setting; the theme is not exposed outside Paseo's tree.
const palettes = {
  dark: {
    surface: "#1e1e22",
    raised: "#2a2a30",
    border: "#3a3a42",
    foreground: "#ececf1",
    muted: "#a1a1aa",
    accent: "#5b8def",
    accentForeground: "#ffffff",
    warning: "#f59e0b",
    danger: "#ef4444",
    success: "#22c55e",
  },
  light: {
    surface: "#ffffff",
    raised: "#f4f4f5",
    border: "#e4e4e7",
    foreground: "#18181b",
    muted: "#71717a",
    accent: "#2563eb",
    accentForeground: "#ffffff",
    warning: "#d97706",
    danger: "#dc2626",
    success: "#16a34a",
  },
};

export type Palette = typeof palettes.dark;

export const usePalette = (): Palette =>
  palettes[useColorScheme() === "light" ? "light" : "dark"];
