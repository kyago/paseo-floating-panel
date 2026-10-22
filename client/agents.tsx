import { getPaseoClient, useHosts } from "@getpaseo/plugin/client";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { type Palette, usePalette } from "./palette";
import { openAgentRoute } from "./web";

type PaseoApi = ReturnType<typeof getPaseoClient>;
type Entry = Awaited<ReturnType<PaseoApi["agents"]["list"]>>["entries"][number];
type Agent = Entry["agent"];
type Permission = Agent["pendingPermissions"][number];
type PermissionResponse = Parameters<
  ReturnType<PaseoApi["agents"]["ref"]>["respondToPermission"]
>[0]["response"];

export type Bucket =
  "needs_input" | "failed" | "running" | "attention" | "done";

interface HostEntry {
  serverId: string;
  host: string;
  agent: Agent;
  project: string;
}

export interface BoardItem extends HostEntry {
  bucket: Bucket;
}

/** Same rule as Paseo's sidebar (protocol deriveAgentStateBucket), which plugins cannot import. */
function bucketOf(agent: Agent): Bucket {
  if (
    agent.pendingPermissions.length > 0 ||
    agent.attentionReason === "permission"
  )
    return "needs_input";
  if (agent.status === "error" || agent.attentionReason === "error")
    return "failed";
  if (agent.status === "running") return "running";
  if (agent.requiresAttention) return "attention";
  return "done";
}

const ORDER: Bucket[] = [
  "needs_input",
  "failed",
  "running",
  "attention",
  "done",
];
const LABEL: Record<Bucket, string> = {
  needs_input: "응답 필요",
  failed: "오류",
  running: "실행 중",
  attention: "완료(확인 전)",
  done: "완료",
};
const tint = (bucket: Bucket, colors: Palette) =>
  ({
    needs_input: colors.warning,
    failed: colors.danger,
    running: colors.accent,
    attention: colors.success,
    done: colors.muted,
  })[bucket];

const baseName = (cwd: string) => cwd.split("/").filter(Boolean).at(-1) ?? cwd;

/**
 * Live agents of every connected host, not just the plugin's own: a client can be connected to several
 * daemons, and each row must navigate and answer on the host that owns it. Subscriptions re-snapshot
 * after a reconnect.
 */
export function useAgentBoard(): BoardItem[] {
  const hosts = useHosts().filter((host) => host.status === "online");
  const hostKey = hosts
    .map((host) => `${host.serverId}\t${host.label}`)
    .join("\n");
  const [entries, setEntries] = useState<Map<string, HostEntry>>(new Map());
  useEffect(() => {
    const lifetime = new AbortController();
    setEntries(new Map());
    for (const line of hostKey ? hostKey.split("\n") : []) {
      const [serverId, host] = line.split("\t");
      const key = (agentId: string) => `${serverId}:${agentId}`;
      const entry = (agent: Agent, project: string): HostEntry => ({
        serverId,
        host,
        agent,
        project,
      });
      void getPaseoClient(serverId)
        .agents.list({
          subscribe: {},
          signal: lifetime.signal,
          sort: [{ key: "updated_at", direction: "desc" }],
          page: { limit: 200 },
        })
        .then(({ subscription }) => {
          subscription.subscribe({
            snapshot: ({ entries: snapshot }) =>
              setEntries((current) => {
                const next = new Map(
                  [...current].filter(
                    ([, value]) => value.serverId !== serverId,
                  ),
                );
                for (const { agent, project } of snapshot)
                  next.set(
                    key(agent.id),
                    entry(agent, project?.projectName ?? baseName(agent.cwd)),
                  );
                return next;
              }),
            update: (message) => {
              if (message.type !== "agent_update") return;
              const update = message.payload;
              setEntries((current) => {
                const next = new Map(current);
                if (update.kind === "upsert") {
                  const project =
                    update.project?.projectName ??
                    current.get(key(update.agent.id))?.project ??
                    baseName(update.agent.cwd);
                  next.set(key(update.agent.id), entry(update.agent, project));
                } else next.delete(key(update.agentId));
                return next;
              });
            },
          });
        })
        .catch((error) => {
          if (!lifetime.signal.aborted)
            console.error(
              `[floating-panel] agent list failed on ${host}`,
              error,
            );
        });
    }
    return () => lifetime.abort();
  }, [hostKey]);
  return [...entries.values()]
    .filter(({ agent }) => !agent.archivedAt)
    .map((entry) => ({ ...entry, bucket: bucketOf(entry.agent) }))
    .sort(
      (a, b) =>
        ORDER.indexOf(a.bucket) - ORDER.indexOf(b.bucket) ||
        b.agent.updatedAt.localeCompare(a.agent.updatedAt),
    );
}

function ago(iso: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - Date.parse(iso)) / 60_000),
  );
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}시간 전`;
  return `${Math.round(minutes / 60 / 24)}일 전`;
}

function PermissionRow({
  serverId,
  agent,
  permission,
}: {
  serverId: string;
  agent: Agent;
  permission: Permission;
}) {
  const colors = usePalette();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Questions need typed answers, which belong in the session itself.
  const choices: {
    label: string;
    response: PermissionResponse;
    danger?: boolean;
  }[] =
    permission.kind === "question"
      ? []
      : permission.actions?.length
        ? permission.actions.map((action) => ({
            label: action.label,
            response: {
              behavior: action.behavior,
              selectedActionId: action.id,
            },
            danger: action.behavior === "deny",
          }))
        : [
            { label: "허용", response: { behavior: "allow" } },
            { label: "거부", response: { behavior: "deny" }, danger: true },
          ];
  const respond = async (response: PermissionResponse) => {
    setPending(true);
    setError(null);
    try {
      await getPaseoClient(serverId)
        .agents.ref(agent.id)
        .respondToPermission({ requestId: permission.id, response });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPending(false);
    }
  };
  return (
    <View
      style={{
        marginTop: 6,
        padding: 8,
        borderRadius: 8,
        backgroundColor: colors.raised,
        gap: 6,
      }}
    >
      <Text
        numberOfLines={2}
        style={{ color: colors.foreground, fontSize: 12 }}
      >
        {permission.title ?? permission.name}
      </Text>
      {permission.description ? (
        <Text numberOfLines={3} style={{ color: colors.muted, fontSize: 11 }}>
          {permission.description}
        </Text>
      ) : null}
      {choices.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {choices.map((choice) => (
            <Pressable
              key={choice.label}
              disabled={pending}
              accessibilityRole="button"
              onPress={() => void respond(choice.response)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
                opacity: pending ? 0.5 : 1,
                backgroundColor: choice.danger ? colors.surface : colors.accent,
                borderWidth: 1,
                borderColor: choice.danger ? colors.border : colors.accent,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: choice.danger
                    ? colors.foreground
                    : colors.accentForeground,
                }}
              >
                {choice.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          세션에서 답해주세요.
        </Text>
      )}
      {error ? (
        <Text style={{ color: colors.danger, fontSize: 11 }}>{error}</Text>
      ) : null}
    </View>
  );
}

function AgentRow({ item, showHost }: { item: BoardItem; showHost: boolean }) {
  const colors = usePalette();
  const { agent, bucket, project, serverId, host } = item;
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${agent.title ?? "제목 없음"} 세션 열기`}
        onPress={() => openAgentRoute(serverId, agent.id, agent.workspaceId)}
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: tint(bucket, colors),
          }}
        />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.foreground, fontSize: 13 }}
          >
            {agent.title ?? "제목 없음"}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>
            {showHost ? `${host} · ` : ""}
            {project} · {LABEL[bucket]} ·{" "}
            {ago(agent.attentionTimestamp ?? agent.updatedAt)}
          </Text>
        </View>
      </Pressable>
      {agent.pendingPermissions.map((permission) => (
        <PermissionRow
          key={permission.id}
          serverId={serverId}
          agent={agent}
          permission={permission}
        />
      ))}
    </View>
  );
}

export function AgentBoard({ items }: { items: BoardItem[] }) {
  const colors = usePalette();
  const [showDone, setShowDone] = useState(false);
  const active = items.filter((item) => item.bucket !== "done");
  const done = items.length - active.length;
  const visible = showDone ? items : active;
  const showHost = new Set(items.map((item) => item.serverId)).size > 1;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        {visible.length ? (
          visible.map((item) => (
            <AgentRow
              key={`${item.serverId}:${item.agent.id}`}
              item={item}
              showHost={showHost}
            />
          ))
        ) : (
          <Text style={{ color: colors.muted, padding: 16 }}>
            진행 중인 에이전트가 없습니다.
          </Text>
        )}
      </ScrollView>
      {done ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowDone((value) => !value)}
          style={{
            padding: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {showDone ? "완료 숨기기" : `완료 ${done}개 보기`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
