import type { PluginClientContext } from "@getpaseo/plugin/client";
import { AppRegistry } from "react-native";
import { FloatingRoot } from "./client/floating";
import { createOverlayRoot } from "./client/web";

const APP_KEY = "paseo-floating-panel";

/** Desktop only: the panel lives in its own root over the window, independent of the sidebar. */
export default function contribute(client: PluginClientContext) {
  const root = createOverlayRoot();
  if (!root) return () => {};
  AppRegistry.registerComponent(APP_KEY, () => () => <FloatingRoot client={client} />);
  AppRegistry.runApplication(APP_KEY, { rootTag: root.element });
  return () => {
    AppRegistry.unmountApplicationComponentAtRootTag(root.element as never);
    root.remove();
  };
}
