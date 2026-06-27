import type { AlertRuleCreatedPayload } from "../../domain/events";
import { ALERT_RULE_CREATED } from "../../domain/events";
import type { DomainEvent } from "../../domain";
import type { IEventBus } from "../EventBus";
import type { RuleDefinitionRepository } from "./RuleDefinitionRepository";

/**
 * @module RuleDefinitionProjector
 * @description Projeta eventos `AlertRuleCreated` para a tabela `rule_definitions`.
 *
 * PATTERN: Observer (EventBus subscriber) — projeção de read-model
 * Por que este pattern: `rule_definitions` é otimizada para leitura no boot do RuleEngine
 * (índices `idx_rules_active`/`idx_rules_type`), separada do event log append-only. Manter
 * a projeção fora do handler preserva a responsabilidade única do handler (gerar eventos,
 * não persistir read-models).
 *
 * Responsabilidade: subscrever-se a `ALERT_RULE_CREATED` no EventBus, gravar a row
 * correspondente em `rule_definitions` via repository.
 * Não faz: compilação da `configuration` em `Rule` (RuleDefinitionCompiler), validação de
 * payload (CreateAlertRuleHandler já validou antes do evento existir).
 *
 * Dependências injetadas:
 * - eventBus: para subscrever a ALERT_RULE_CREATED
 * - repository: para persistir a row projetada
 */
export class RuleDefinitionProjector {
  private unsubscribe: (() => Promise<void>) | null = null;

  constructor(
    private readonly eventBus: IEventBus,
    private readonly repository: RuleDefinitionRepository
  ) {}

  /**
   * Inicia a subscrição. Deve ser chamado uma vez no bootstrap.
   * @throws Error se já está iniciado
   */
  start(): void {
    if (this.unsubscribe) {
      throw new Error("RuleDefinitionProjector already started");
    }

    this.unsubscribe = this.eventBus.subscribe(ALERT_RULE_CREATED, (event) =>
      this.project(event)
    );
  }

  /**
   * Persiste a row de `rule_definitions` correspondente ao evento recebido.
   * Erros são logados e não propagados — falha em projetar não deve derrubar o publisher.
   *
   * @param event - DomainEvent recebido do EventBus (sempre AlertRuleCreated, dado o filtro de subscribe)
   */
  private async project(event: DomainEvent): Promise<void> {
    const payload = event.payload as AlertRuleCreatedPayload;

    try {
      await this.repository.insert({
        id: event.aggregateId,
        name: payload.name,
        description: payload.description ?? null,
        ruleType: payload.ruleType,
        configuration: payload.configuration,
        isActive: true,
      });
    } catch (err) {
      console.error(
        `RuleDefinitionProjector failed to persist rule "${payload.name}" (${event.aggregateId}):`,
        err
      );
    }
  }

  /** Remove a subscrição do EventBus. */
  async stop(): Promise<void> {
    if (this.unsubscribe) {
      await this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
