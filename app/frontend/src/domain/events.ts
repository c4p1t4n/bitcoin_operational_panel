/**
 * @module domain/events
 * @description Vocabulário de eventos de domínio do lado do frontend — tipos e constantes
 * próprios, não importados do backend.
 *
 * Por que duplicar em vez de importar `app/backend/src/domain/events`: aqueles módulos
 * importam `node:crypto` (via `DomainEvent` base class) e não são pensados para rodar no
 * navegador; um import de *valor* (não apenas de tipo) arrastaria esse código para o bundle
 * do Vite e quebraria em runtime. O contrato realmente compartilhado entre backend e
 * frontend é o JSON que atravessa o WebSocket — é isso que este módulo tipa.
 *
 * Responsabilidade: tipar o formato serializado (`DomainEventWire`, com `occurredAt` como
 * string) e o formato normalizado para uso em componentes (`DomainEventView`, com
 * `occurredAt` como `Date`), mais as constantes de `eventType` usadas para filtrar.
 */

export const ALERT_TRIGGERED = "ALERT_TRIGGERED" as const;
export const ALERT_ACKNOWLEDGED = "ALERT_ACKNOWLEDGED" as const;
export const ALERT_RULE_CREATED = "ALERT_RULE_CREATED" as const;
export const MEMPOOL_FEE_SPIKE = "MEMPOOL_FEE_SPIKE" as const;
export const PEER_CONNECTED = "PEER_CONNECTED" as const;
export const PEER_DISCONNECTED = "PEER_DISCONNECTED" as const;
export const NEW_BLOCK_MINED = "NEW_BLOCK_MINED" as const;
export const TRANSACTION_DETECTED = "TRANSACTION_DETECTED" as const;

export interface AlertTriggeredPayload {
  ruleId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description?: string;
  sourceEventId: string;
}

export interface AlertAcknowledgedPayload {
  acknowledgedByUserId: string;
  note?: string;
}

export interface MemPoolFeeSpikePayload {
  feeRateSatPerVb: number;
  baselineSatPerVb: number;
  deltaPct: number;
}

/** Formato serializado recebido via WebSocket — `occurredAt` chega como string ISO (JSON não tem tipo Date). */
export interface DomainEventWire {
  id: string;
  occurredAt: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  version: number;
  payload: unknown;
}

/** Formato normalizado para uso em componentes — `occurredAt` já convertido para `Date`. */
export interface DomainEventView extends Omit<DomainEventWire, "occurredAt"> {
  occurredAt: Date;
}

/** Converte o formato serializado para o normalizado. */
export function normalizeDomainEvent(wire: DomainEventWire): DomainEventView {
  return { ...wire, occurredAt: new Date(wire.occurredAt) };
}
