import type { DomainEvent } from "../domain";

/**
 * @module EventBus
 * @description Pub/sub para eventos de domínio. MVP usa em-memória; Phase 5+ integra Redis.
 *
 * PATTERN: Observer (Pub/Sub)
 * Por que este pattern: desacoplamento entre produtores (EventStore, CommandBus) e
 * consumidores (RuleEngine, frontend subscriptions, audit trail). Redis é para
 * distribuição entre múltiplas instâncias (Phase 5+).
 *
 * Responsabilidade: publicar DomainEvents para subscribers registrados; subscribers
 * reagem de forma independente (ex: RuleEngine avalia regras, audit trail persiste).
 * Não faz: persistência de eventos (EventStore), validação de payloads (CommandBus).
 */

export type EventBusSubscriber = (event: DomainEvent) => Promise<void>;

export interface IEventBus {
  publish(events: DomainEvent[]): Promise<void>;
  subscribe(
    eventType: string,
    handler: EventBusSubscriber
  ): () => Promise<void>;
}

export class EventBus implements IEventBus {
  private subscribers: Map<string, Set<EventBusSubscriber>> = new Map();

  constructor() {
    // MVP: in-memory pub/sub. Phase 5+ can inject Redis client.
  }

  /**
   * Publica eventos para todos os subscribers registrados do respectivo event type.
   * Executa subscribers em paralelo. Se um subscriber falhar, o erro é capturado
   * e logado — outros subscribers são chamados mesmo assim.
   *
   * @param events - array de DomainEvents a publicar
   * @throws nunca — erros de subscribers são capturados
   */
  async publish(events: DomainEvent[]): Promise<void> {
    const promises = events.map(async (event) => {
      const handlers = this.subscribers.get(event.eventType);
      if (!handlers || handlers.size === 0) return;

      await Promise.allSettled(
        Array.from(handlers).map((handler) =>
          handler(event).catch((err) => {
            console.error(
              `EventBus subscriber error for ${event.eventType}:`,
              err
            );
          })
        )
      );
    });

    await Promise.all(promises);
  }

  /**
   * Registra um subscriber para um tipo de evento específico.
   * Retorna função de unsubscribe para remover o subscriber.
   *
   * @param eventType - tipo de evento para se inscrever (ex: "ALERT_TRIGGERED")
   * @param handler - função assíncrona que processa o evento
   * @returns função que, quando chamada, remove o subscriber
   */
  subscribe(eventType: string, handler: EventBusSubscriber): () => Promise<void> {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(handler);

    return async () => {
      this.subscribers.get(eventType)?.delete(handler);
    };
  }
}
