import { useSyncExternalStore } from "react";
import { webSocketFeed, type WebSocketFeedSnapshot } from "../store/WebSocketFeed";

/**
 * @module hooks/useDomainEvents
 * @description Hook fino sobre `useSyncExternalStore` + `WebSocketFeed`.
 *
 * Responsabilidade: dar a qualquer componente acesso ao snapshot atual (`events`, `status`)
 * do `WebSocketFeed`, re-renderizando quando ele muda.
 * Não faz: filtrar eventos por tipo — cada componente filtra o que precisa do array bruto.
 */
export function useDomainEvents(): WebSocketFeedSnapshot {
  return useSyncExternalStore(webSocketFeed.subscribe, webSocketFeed.getSnapshot);
}
