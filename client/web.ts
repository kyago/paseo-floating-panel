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
declare const window: {
  history: { pushState(state: null, unused: string, url: string): void };
  dispatchEvent(event: unknown): void;
};
declare const PopStateEvent: new (type: "popstate") => unknown;
declare const localStorage: {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const ROOT_ID = "paseo-floating-panel-root";
const POSITION_KEY = "paseo-floating-panel:position";
const OPEN_KEY = "paseo-floating-panel:open";

export interface Offset {
  right: number;
  bottom: number;
}

/** A click-through layer over the whole window, outside Paseo's layout so the sidebar cannot unmount it. */
export function createOverlayRoot(): {
  element: OverlayElement;
  remove(): void;
} | null {
  if (Platform.OS !== "web") return null;
  document.getElementById(ROOT_ID)?.remove();
  const element = document.createElement("div");
  element.id = ROOT_ID;
  element.style.cssText =
    "position:fixed;inset:0;display:flex;flex-direction:column;pointer-events:none;z-index:40;";
  document.body.appendChild(element);
  return { element, remove: () => element.remove() };
}

export function loadPosition(): Offset | null {
  if (Platform.OS !== "web") return null;
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null");
    return typeof value?.right === "number" && typeof value?.bottom === "number"
      ? value
      : null;
  } catch {
    return null;
  }
}

export function savePosition(offset: Offset): void {
  if (Platform.OS === "web")
    localStorage.setItem(POSITION_KEY, JSON.stringify(offset));
}

/**
 * Paseo's own route for an agent tab, `/h/<server>/workspace/<id>?open=agent:<id>` (what the app builds
 * for agent links); popstate makes the app's router follow it. Workspace ids outside
 * [A-Za-z0-9._~-] use an encoding we do not reproduce, so those fall back to `/h/<server>/agent/<id>`.
 */
export function openAgentRoute(
  serverId: string,
  agentId: string,
  workspaceId?: string,
): void {
  if (Platform.OS !== "web") return;
  const host = `/h/${encodeURIComponent(serverId)}`;
  const route =
    workspaceId && /^[A-Za-z0-9._~-]+$/.test(workspaceId)
      ? `${host}/workspace/${workspaceId}?open=${encodeURIComponent(`agent:${agentId}`)}`
      : `${host}/agent/${encodeURIComponent(agentId)}`;
  window.history.pushState(null, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Open/closed survives remounts: Paseo can restart the plugin's client entry, e.g. while navigating. */
export function loadOpen(): boolean {
  return Platform.OS === "web" && localStorage.getItem(OPEN_KEY) === "1";
}

export function saveOpen(open: boolean): void {
  if (Platform.OS === "web") localStorage.setItem(OPEN_KEY, open ? "1" : "0");
}
