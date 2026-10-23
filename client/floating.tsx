import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
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
import { AgentBoard, useAgentBoard } from "./agents";
import { usePalette } from "./palette";
import {
  loadOpen,
  loadPosition,
  type Offset,
  saveOpen,
  savePosition,
} from "./web";

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

function FloatingPanel({
  title,
  badge,
  children,
}: {
  title: string;
  badge: number;
  children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const colors = usePalette();
  const [open, setOpenState] = useState(loadOpen);
  const setOpen = (value: boolean) => {
    setOpenState(value);
    saveOpen(value);
  };
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
            borderRadius: 14,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
          },
          webStyle({ cursor: "pointer", userSelect: "none" }),
        ]}
      >
        <Icon name="LayoutDashboard" size={24} color={colors.accentForeground} />
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              paddingHorizontal: 5,
              borderRadius: 10,
              backgroundColor: colors.warning,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.surface, fontSize: 11, fontWeight: "700" }}>
              {badge}
            </Text>
          </View>
        ) : null}
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
          {title}
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
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function Content() {
  const items = useAgentBoard();
  const badge = items.filter(
    (item) => item.bucket === "needs_input" || item.bucket === "failed",
  ).length;
  return (
    <FloatingPanel title="에이전트" badge={badge}>
      <AgentBoard items={items} />
    </FloatingPanel>
  );
}

export function FloatingRoot({ client }: { client: PluginClientContext }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  return (
    <ClientContext.Provider value={client}>
      <QueryClientProvider client={queryClient}>
        <View pointerEvents="box-none" style={{ flex: 1 }}>
          <Content />
        </View>
      </QueryClientProvider>
    </ClientContext.Provider>
  );
}
