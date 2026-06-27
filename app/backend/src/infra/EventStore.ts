import { eq } from "drizzle-orm";
import type { Command, DomainEvent } from "../domain";
import { events as eventsTable } from "../../../infra/schema";
import type { Database } from "../db";
import type { IEventBus } from "./EventBus";

/**
 * @module EventStore
 * @description Coração do event sourcing — append-only log com optimistic locking.
 *
 * PATTERN: Event Sourcing
 * Por que este pattern: fonte única da verdade é o log de eventos, não o estado atual.
 * Recuperação é replay, auditing é integrado, concorrência é detectada via version conflict.
 *
 * Responsabilidade: persistir eventos no log append-only com constraint de versão,
 * recuperar eventos de um agregado, publicar para EventBus após persistir.
 * Não faz: validação de payload (CommandBus), dispatch de commands, tratamento de regras.
 *
 * Dependências injetadas:
 * - db: cliente Drizzle para acesso à events table
 * - eventBus: para publicar após append bem-sucedido
 */

export class OptimisticConcurrencyError extends Error {
  constructor(
    readonly aggregateId: string,
    readonly expectedVersion: number
  ) {
    super(
      `OptimisticConcurrencyError: conflict on ${aggregateId} at version ${expectedVersion}`
    );
    this.name = "OptimisticConcurrencyError";
  }
}

export interface IEventStore {
  append(command: Command, events: DomainEvent[]): Promise<void>;
  getEventsFor(aggregateId: string): Promise<DomainEvent[]>;
}

export class EventStore implements IEventStore {
  constructor(
    private readonly db: Database,
    private readonly eventBus: IEventBus
  ) {}

  /**
   * Persiste eventos gerados por um command no log append-only.
   * Detecta concurrent writes via UNIQUE(aggregate_id, version) — se versão já existe,
   * lança OptimisticConcurrencyError. Publica para EventBus após sucesso.
   *
   * @param command - comando que gerou os eventos
   * @param events - array de DomainEvents a persistir
   * @throws OptimisticConcurrencyError - se versão do agregado já foi alterada
   */
  async append(command: Command, events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      for (const event of events) {
        await this.db.insert(eventsTable).values({
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          eventType: event.eventType,
          version: event.version,
          payload: event.payload as unknown,
          metadata: {
            commandId: command.id,
            commandType: command.commandType,
          },
          occurredAt: event.occurredAt,
        });
      }

      await this.eventBus.publish(events);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("duplicate key value violates unique constraint")
      ) {
        const firstEvent = events[0]!;
        throw new OptimisticConcurrencyError(
          firstEvent.aggregateId,
          firstEvent.version
        );
      }
      throw err;
    }
  }

  /**
   * Recupera todos os eventos de um agregado, ordenados por versão.
   * Retorna array vazio se agregado não existe.
   *
   * @param aggregateId - identificador do agregado
   * @returns array de DomainEvents em ordem (versão crescente)
   */
  async getEventsFor(aggregateId: string): Promise<DomainEvent[]> {
    const rows = await this.db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.aggregateId, aggregateId))
      .orderBy(eventsTable.version);

    return rows.map((row) => ({
      id: row.id,
      aggregateId: row.aggregateId,
      aggregateType: row.aggregateType,
      eventType: row.eventType,
      version: row.version,
      payload: row.payload,
      occurredAt: row.occurredAt,
    })) as DomainEvent[];
  }
}
