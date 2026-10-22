# paseo-floating-panel

PC(웹 기반 데스크톱 앱)에서 Paseo 창 위에 떠 있는 플로팅 버튼/패널. 모바일·768px 미만 창에서는 표시하지 않는다.

- 접힘: 오른쪽 아래 원형 버튼. 클릭하면 패널(360×480)로 펼쳐짐, 헤더의 `—`로 다시 접힘. 펼침/접힘 상태는 localStorage에 저장돼 세션 이동·재시작 후에도 유지
- 드래그: 버튼 또는 패널 헤더를 끌어 위치 이동, 위치는 localStorage에 저장
- 에이전트 현황판: 앱에 연결된 모든 온라인 호스트의 보관되지 않은 에이전트를 상태별(응답 필요 → 오류 → 실행 중 → 완료(확인 전))로 표시. 행을 누르면 그 에이전트의 호스트·워크스페이스 탭으로 이동, 권한 요청은 패널에서 바로 허용·거부(질문형은 세션에서 답함). 완료된 세션은 접어 두고 개수만 표시. 접힌 버튼에는 응답 필요+오류 개수 배지
- 사이드바와 무관: `document.body`에 별도 레이어를 만들고 `AppRegistry.runApplication`으로 독립 React 루트를 띄움

## 컴포넌트 추가 시 주의

패널은 Paseo의 플러그인 화면 밖에 있는 별도 루트라 `usePaseo()`·`useRpc()`·`useSettings()`가 동작하지 않는다(`usePaseo must run inside a contributed plugin surface`).
대신 `useFloatingClient()`로 `paseo`, `rpc`, `openScreen`, `openPanel`을 쓴다. TanStack Query는 패널 자체 `QueryClient`로 동작한다.
`theme` prop도 없어서 색은 OS 라이트/다크 모드를 따른다(`client/floating.tsx`의 `palettes`).

새 컴포넌트는 `client/floating.tsx`의 `Content`에서 `FloatingPanel` 자식으로 넣는다. 세션 이동은 `client/web.ts`의 `openAgentRoute`(Paseo 라우트 `/h/<server>/workspace/<id>?open=agent:<id>`로 pushState). 호스트별 Paseo 호출은 `getPaseoClient(serverId)`.
