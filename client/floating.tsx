import type { PluginClientContext } from "@getpaseo/plugin/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  PanResponder,
  Pressable,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { loadPosition, type Offset, savePosition } from "./web";

/**
 * The floating layer is its own React root, outside Paseo's providers, so plugin hooks such as
 * usePaseo() and useRpc() are unavailable inside it. Components here use useFloatingClient().
 */
const ClientContext = createContext<PluginClientContext | null>(null);

export function useFloatingClient(): PluginClientContext {
  const client = useContext(ClientContext);
  if (!client)
    throw new Error(
      "useFloatingClient() must be used inside the floating panel",
    );
  return client;
}

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
  },
  light: {
    surface: "#ffffff",
    raised: "#f4f4f5",
    border: "#e4e4e7",
    foreground: "#18181b",
    muted: "#71717a",
    accent: "#2563eb",
    accentForeground: "#ffffff",
  },
};

// react-native-web accepts these CSS properties; React Native's types do not list them.
const webStyle = (style: Record<string, string>) => style as ViewStyle;

const BUTTON = 52;
const PANEL = { width: 360, height: 480 };
const MIN_WINDOW_WIDTH = 768;
const DRAG_THRESHOLD = 4;

/** Drag that moves a bottom-right anchor; a press that barely moves counts as a tap. */
function useDrag(
  offset: Offset,
  onMove: (offset: Offset) => void,
  onEnd: () => void,
  onTap?: () => void,
) {
  const latest = useRef({ offset, onMove, onEnd, onTap });
  latest.current = { offset, onMove, onEnd, onTap };
  const start = useRef(offset);
  const moved = useRef(false);
  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          start.current = latest.current.offset;
          moved.current = false;
        },
        onPanResponderMove: (_, { dx, dy }) => {
          if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD)
            moved.current = true;
          if (moved.current)
            latest.current.onMove({
              right: start.current.right - dx,
              bottom: start.current.bottom - dy,
            });
        },
        onPanResponderRelease: () =>
          moved.current ? latest.current.onEnd() : latest.current.onTap?.(),
        onPanResponderTerminate: () => latest.current.onEnd(),
      }).panHandlers,
    [],
  );
}

function FloatingPanel({ children }: { children?: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const colors = palettes[useColorScheme() === "light" ? "light" : "dark"];
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState<Offset>(
    () => loadPosition() ?? { right: 24, bottom: 24 },
  );
  const box = open ? PANEL : { width: BUTTON, height: BUTTON };
  const place = (value: Offset): Offset => ({
    right: Math.min(Math.max(value.right, 0), Math.max(width - box.width, 0)),
    bottom: Math.min(
      Math.max(value.bottom, 0),
      Math.max(height - box.height, 0),
    ),
  });
  const commit = () => savePosition(offset);
  const buttonDrag = useDrag(
    offset,
    (value) => setOffset(place(value)),
    commit,
    () => setOpen(true),
  );
  const headerDrag = useDrag(
    offset,
    (value) => setOffset(place(value)),
    commit,
  );

  if (width < MIN_WINDOW_WIDTH) return null;
  const position = { position: "absolute" as const, ...place(offset) };

  if (!open) {
    return (
      <View
        {...buttonDrag}
        accessibilityRole="button"
        accessibilityLabel="플로팅 패널 열기"
        style={[
          position,
          {
            width: BUTTON,
            height: BUTTON,
            borderRadius: BUTTON / 2,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
          },
          webStyle({ cursor: "pointer", userSelect: "none" }),
        ]}
      >
        <Text style={{ color: colors.accentForeground, fontSize: 22 }}>✦</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        position,
        {
          ...PANEL,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        },
      ]}
    >
      <View
        {...headerDrag}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            height: 40,
            gap: 8,
            backgroundColor: colors.raised,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          webStyle({ cursor: "move", userSelect: "none" }),
        ]}
      >
        <Text style={{ flex: 1, color: colors.foreground, fontWeight: "600" }}>
          Floating panel
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="플로팅 패널 접기"
          onPress={() => setOpen(false)}
          style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
        >
          <Text style={{ color: colors.muted, fontSize: 16 }}>—</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, padding: 16 }}>
        {children ?? (
          <Text style={{ color: colors.muted }}>
            컴포넌트를 여기에 추가하세요.
          </Text>
        )}
      </View>
    </View>
  );
}

export function FloatingRoot({ client }: { client: PluginClientContext }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  return (
    <ClientContext.Provider value={client}>
      <QueryClientProvider client={queryClient}>
        <View pointerEvents="box-none" style={{ flex: 1 }}>
          <FloatingPanel />
        </View>
      </QueryClientProvider>
    </ClientContext.Provider>
  );
}
