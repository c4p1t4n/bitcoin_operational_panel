import type { DomainEvent } from "../domain";
import {
  MEMPOOL_FEE_SPIKE,
  ALERT_TRIGGERED,
  ALERT_ACKNOWLEDGED,
  PEER_CONNECTED,
  PEER_DISCONNECTED,
  NEW_BLOCK_MINED,
  TRANSACTION_DETECTED,
} from "../domain/events";
import type { ICommandDispatcher } from "./CommandBus";
import type { IEventBus } from "./EventBus";
import type { Rule } from "./rules/Rule";
import type { ConditionMatcher } from "./rules/ConditionMatcher";

/** Todos os tipos de evento de domínio conhecidos — usado para subscrever o RuleEngine a cada um. */
const ALL_EVENT_TYPES = [
  MEMPOOL_FEE_SPIKE,
  ALERT_TRIGGERED,
  ALERT_ACKNOWLEDGED,
  PEER_CONNECTED,
  PEER_DISCONNECTED,
  NEW_BLOCK_MINED,
  TRANSACTION_DETECTED,
] as const;

/**
 * @module RuleEngine
 * @description Avalia eventos de domínio contra regras de alerta configuradas e despacha
 * commands quando as condições são satisfeitas.
 *
 * PATTERN: Chain of Responsibility + Strategy
 * Por que este pattern: cada regra é avaliada independentemente do resultado das demais
 * (erro em uma não derruba as outras); cada condição delega sua lógica a um ConditionMatcher
 * (Strategy), permitindo novos tipos de condição sem modificar o RuleEngine (Open/Closed).
 *
 * Responsabilidade: subscrever-se a todos os tipos de evento via EventBus, avaliar cada evento
 * contra as regras ativas, despachar o command da ação via CommandBus quando todas as condições
 * de uma regra são satisfeitas.
 * Não faz: persistência de regras (Phase 5 carrega de `rule_definitions`), validação de payload
 * de commands (CommandBus), avaliação de uma condição individual (ConditionMatcher).
 *
 * Dependências injetadas:
 * - eventBus: para subscrever a todos os tipos de evento de domínio
 * - commandBus: para despachar o command produzido pela ação de uma regra que casou
 *   (deve ser instanciado com um getCurrentUser que retorna um ator de sistema autorizado,
 *   ex: { id: "system", role: "ADMIN" }, já que o RuleEngine não tem um usuário autenticado)
 */
export class RuleEngine {
  private rules: Rule[] = [];
  private matchers: Map<string, ConditionMatcher> = new Map();
  private unsubscribers: Array<() => Promise<void>> = [];

  constructor(
    private readonly eventBus: IEventBus,
    private readonly commandBus: ICommandDispatcher
  ) {}

  /**
   * Registra uma estratégia de avaliação de condição.
   * Deve ser chamado durante bootstrap, antes de addRule.
   *
   * @param matcher - implementação de ConditionMatcher
   */
  registerMatcher(matcher: ConditionMatcher): void {
    this.matchers.set(matcher.conditionType, matcher);
  }

  /**
   * Adiciona uma regra ativa à lista avaliada em cada evento.
   * @param rule - Rule compilada (ver AlertRuleBuilder)
   */
  addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  /**
   * Subscreve o RuleEngine a todos os tipos de evento de domínio conhecidos.
   * Idempotente apenas na primeira chamada — chamadas subsequentes lançam.
   *
   * @throws Error se já foi inicializado
   */
  async bootstrap(): Promise<void> {
    if (this.unsubscribers.length > 0) {
      throw new Error("RuleEngine already bootstrapped");
    }

    for (const eventType of ALL_EVENT_TYPES) {
      const unsubscribe = this.eventBus.subscribe(eventType, (event) =>
        this.evaluateEvent(event)
      );
      this.unsubscribers.push(unsubscribe);
    }
  }

  /**
   * Avalia um evento contra todas as regras ativas e despacha o command de cada
   * regra que casar. Fire-and-forget: erros de dispatch ou de avaliação são logados
   * e não interrompem a avaliação das demais regras.
   *
   * @param event - evento de domínio recebido do EventBus
   */
  private async evaluateEvent(event: DomainEvent): Promise<void> {
    for (const rule of this.rules) {
      if (!rule.active) continue;

      try {
        if (this.ruleMatches(rule, event)) {
          this.commandBus.dispatch(rule.action.buildCommand(event)).catch((err) => {
            console.error(
              `RuleEngine error dispatching command for rule "${rule.name}" (${rule.id}):`,
              err
            );
          });
        }
      } catch (err) {
        console.error(
          `RuleEngine evaluation error for rule "${rule.name}" (${rule.id}):`,
          err
        );
      }
    }
  }

  /**
   * Verifica se todas as condições da regra (AND lógico) são satisfeitas pelo evento.
   *
   * @param rule - regra com lista de condições
   * @param event - evento a avaliar
   * @returns true se todas as condições casam
   */
  private ruleMatches(rule: Rule, event: DomainEvent): boolean {
    return rule.conditions.every((condition) => {
      const matcher = this.matchers.get(condition.type);
      if (!matcher) {
        console.warn(`No matcher registered for condition type: ${condition.type}`);
        return false;
      }
      return matcher.matches(event, condition.threshold);
    });
  }

  /**
   * Remove todas as subscrições do EventBus.
   */
  async shutdown(): Promise<void> {
    await Promise.all(this.unsubscribers.map((unsubscribe) => unsubscribe()));
    this.unsubscribers = [];
  }
}
