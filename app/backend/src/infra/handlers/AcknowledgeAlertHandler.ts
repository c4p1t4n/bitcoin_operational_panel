import type { DomainEvent } from "../../domain";
import { AlertAcknowledged } from "../../domain/events";
import type { AcknowledgeAlert } from "../../domain/commands";
import type { CommandHandler } from "../CommandBus";

/**
 * @module AcknowledgeAlertHandler
 * @description Handler que processa AcknowledgeAlert command.
 *
 * PATTERN: Strategy
 * Por que este pattern: strategy específica para comando de acknowledgment.
 *
 * Responsabilidade: gerar AlertAcknowledged event refletindo a ação do usuário.
 * Não faz: persistência (EventStore), validação de permissão (CommandBus).
 */

export class AcknowledgeAlertHandler implements CommandHandler {
  readonly commandType = "ACKNOWLEDGE_ALERT";

  /**
   * Processa confirmação de alerta pelo usuário.
   * Gera AlertAcknowledged event com metadados do usuário que confirmou.
   *
   * @param command - AcknowledgeAlert command com aggregateId = alertId
   * @returns array com um AlertAcknowledged event
   */
  async handle(command: AcknowledgeAlert): Promise<DomainEvent[]> {
    const event = new AlertAcknowledged(
      command.aggregateId,
      1, // TODO: carregar versão atual do agregado via EventStore.getEventsFor
      {
        acknowledgedByUserId: command.payload.acknowledgedByUserId,
        note: command.payload.note,
      }
    );

    return [event];
  }
}
