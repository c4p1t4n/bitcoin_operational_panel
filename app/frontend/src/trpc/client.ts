import {
  createTRPCClient,
  createWSClient,
  splitLink,
  wsLink,
  httpBatchLink,
} from "@trpc/client";
import type { AppRouter } from "../../../backend/src/trpc/routers";
import { getCurrentUserId } from "../auth/currentUser";

/**
 * @module trpc/client
 * @description Client tRPC vanilla — sem `@trpc/react-query`, por design (ver
 * `docs/features/frontend-dashboard/plan.md`, Decisão 1): o `WebSocketFeed` é o external
 * store que mantém o stream, não hooks de data-fetching.
 *
 * Responsabilidade: rotear mutations/queries via HTTP (`httpBatchLink`) e subscriptions via
 * WebSocket (`wsLink`); resolver o "usuário atual" em cada chamada — header `x-user-id` no
 * HTTP, `connectionParams` no WS (navegadores não permitem headers customizados no
 * handshake de WebSocket).
 * Não faz: lógica de UI, buffer de eventos (WebSocketFeed).
 */

const HTTP_URL = import.meta.env.VITE_TRPC_HTTP_URL ?? "http://localhost:4000";
const WS_URL = import.meta.env.VITE_TRPC_WS_URL ?? "ws://localhost:4000";

export const wsClient = createWSClient({
  url: WS_URL,
  connectionParams: () => ({ userId: getCurrentUserId() ?? "" }),
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ client: wsClient }),
      false: httpBatchLink({
        url: HTTP_URL,
        headers: () => {
          const userId = getCurrentUserId();
          return userId ? { "x-user-id": userId } : {};
        },
      }),
    }),
  ],
});
