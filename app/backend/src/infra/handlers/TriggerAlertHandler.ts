import type { DomainEvent } from "../../domain";
import { AlertTriggered } from "../../domain/events";
import type { TriggerAlert } from "../../domain/commands";
import type { CommandHandler } from "../CommandBus";

/**
 * @module TriggerAlertHandler
 * @description Handler que processa TriggerAlert command.
 *
 * PATTERN: Strategy
 * Por que este pattern: strategy específica para a criação de um alerta; o RuleEngine
 * (Fase 4) é o principal originador deste command, mas qualquer caller autorizado pode usá-lo.
 *
 * Responsabilidade: gerar o evento AlertTriggered a partir do payload do command.
 * Não faz: avaliação de condições (RuleEngine), persistência (EventStore).
 */

export class TriggerAlertHandler implements CommandHandler {
  readonly commandType = "TRIGGER_ALERT";

  /**
   * Processa a criação de um alerta.
   *
   * @param command - TriggerAlert command com aggregateId = id do novo alerta
   * @returns array com um AlertTriggered event
   */
  async handle(command: TriggerAlert): Promise<DomainEvent[]> {
    const event = new AlertTriggered(command.aggregateId, 1, {
      ruleId: command.payload.ruleId,
      severity: command.payload.severity,
      title: command.payload.title,
      description: command.payload.description,
      sourceEventId: command.payload.sourceEventId,
    });
    return [event];
  }
}
