import { randomUUID } from "node:crypto";
import type { AggregateType } from "../types";

/**
 * @module DomainEvent
 * @description Classe base para todo evento de domínio do sistema.
 *
 * PATTERN: Domain Event
 * Por que este pattern: separa "o que aconteceu no negócio" (este objeto, em memória)
 * de "como foi persistido" (a row em `events`, que é responsabilidade do EventStore).
 *
 * Responsabilidade: carregar os dados imutáveis de um evento ocorrido — id, agregado, tipo, payload.
 * Não faz: persistência (EventStore), serialização para JSONB (EventStore), publicação (EventBus).
 */
export abstract class DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly occurredAt: Date;

  /**
   * @param aggregateId - identificador do agregado afetado (ex: id de uma AlertRule)
   * @param aggregateType - tipo do agregado afetado
   * @param eventType - discriminador do evento (ex: "MEMPOOL_FEE_SPIKE")
   * @param version - versão do agregado após este evento (usado no optimistic locking)
   * @param payload - dados específicos da subclasse
   */
  protected constructor(
    readonly aggregateId: string,
    readonly aggregateType: AggregateType,
    readonly eventType: string,
    readonly version: number,
    readonly payload: TPayload
  ) {
    this.id = randomUUID();
    this.occurredAt = new Date();
  }
}
