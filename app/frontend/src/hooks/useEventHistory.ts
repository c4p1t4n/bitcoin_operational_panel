import { useMemo } from "react";
import { useDomainEvents } from "./useDomainEvents";
import type { DomainEventView } from "../domain/events";
import type { ConnectionStatus } from "../store/WebSocketFeed";

/**
 * @module hooks/useEventHistory
 * @description Fonte de dados do histórico de eventos, desacoplada do componente de tabela.
 *
 * PATTERN: Adapter / Dependency Inversion
 * Por que este pattern: o `EventHistoryTable` depende da abstração "lista de eventos mais
 * recentes primeiro", não de onde ela vem. Hoje a origem é o buffer ao vivo do
 * `WebSocketFeed` (via `useDomainEvents`); quando o backend expuser `events.list`, basta
 * trocar a implementação deste hook por `trpcClient.events.list.query(...)` — o componente
 * não muda.
 *
 * Responsabilidade: devolver os eventos em ordem cronológica inversa (mais recente primeiro)
 * mais o status de conexão e a origem dos dados.
 * Não faz: renderização (EventHistoryTable), parsing de payload por tipo (cada coluna
 * formata o que precisa).
 */

export interface EventHistoryResult {
  /** Eventos mais recentes primeiro. */
  rows: readonly DomainEventView[];
  /** Status da conexão ao vivo — reaproveitado do feed. */
  status: ConnectionStatus;
  /** Origem dos dados: "live" enquanto não há query persistida; "persisted" depois. */
  source: "live" | "persisted";
}

/**
 * Devolve o histórico de eventos para a tabela.
 *
 * @returns lista ordenada (mais recente primeiro), status de conexão e origem dos dados
 */
export function useEventHistory(): EventHistoryResult {
  const { events, status } = useDomainEvents();

  // `events` chega em ordem cronológica crescente; a tabela mostra do mais recente.
  // useMemo garante referência estável de `rows` enquanto o snapshot não muda
  // (importante para o AG Grid evitar re-render desnecessário).
  const rows = useMemo(() => [...events].reverse(), [events]);

  return { rows, status, source: "live" };
}
