import { randomUUID } from "node:crypto";

/**
 * @module Command
 * @description Classe base para toda intenção de mudança de estado no sistema.
 *
 * PATTERN: Command
 * Por que este pattern: separa "a intenção de mudar algo" (este objeto) de "a mudança em si"
 * (os DomainEvents que o handler produz). O CommandBus (Fase 3) recebe Command, devolve DomainEvent[].
 *
 * Responsabilidade: carregar id, agregado-alvo, tipo e payload de uma intenção de mudança.
 * Não faz: validação de permissão (PermissionSpec), validação de payload, persistência (CommandBus/EventStore).
 */
export abstract class Command<TPayload = unknown> {
  readonly id: string;
  readonly requestedAt: Date;

  /**
   * @param aggregateId - identificador do agregado a ser alterado
   * @param commandType - discriminador do comando (ex: "CREATE_ALERT_RULE")
   * @param payload - dados específicos da subclasse
   */
  protected constructor(
    readonly aggregateId: string,
    readonly commandType: string,
    readonly payload: TPayload
  ) {
    this.id = randomUUID();
    this.requestedAt = new Date();
  }
}
