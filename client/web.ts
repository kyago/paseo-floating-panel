import { Platform } from "react-native";

// This plugin typechecks without the DOM library. Declare only what this module uses.
interface OverlayElement {
  id: string;
  style: { cssText: string };
  remove(): void;
}
declare const document: {
  getElementById(id: string): OverlayElement | null;
  createElement(tag: "div"): OverlayElement;
  body: { appendChild(element: OverlayElement): void };
};
declare const localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };

const ROOT_ID = "paseo-floating-panel-root";
const POSITION_KEY = "paseo-floating-panel:position";

export interface Offset {
  right: number;
  bottom: number;
}

/** A click-through layer over the whole window, outside Paseo's layout so the sidebar cannot unmount it. */
export function createOverlayRoot(): { element: OverlayElement; remove(): void } | null {
  if (Platform.OS !== "web") return null;
  document.getElementById(ROOT_ID)?.remove();
  const element = document.createElement("div");
  element.id = ROOT_ID;
  element.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:40;";
  document.body.appendChild(element);
  return { element, remove: () => element.remove() };
}

export function loadPosition(): Offset | null {
  if (Platform.OS !== "web") return null;
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null");
    return typeof value?.right === "number" && typeof value?.bottom === "number" ? value : null;
  } catch {
    return null;
  }
}

export function savePosition(offset: Offset): void {
  if (Platform.OS === "web") localStorage.setItem(POSITION_KEY, JSON.stringify(offset));
}
