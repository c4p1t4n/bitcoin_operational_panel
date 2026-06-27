import type { DomainEvent } from "../../domain";

/**
 * @module ConditionMatcher
 * @description Strategy para avaliar se um DomainEvent satisfaz uma condição configurada.
 *
 * PATTERN: Strategy
 * Por que este pattern: cada tipo de condição (fee spike, tamanho de transação, contagem de
 * peers) tem sua própria lógica de avaliação. Novos matchers entram sem modificar o RuleEngine
 * nem os matchers existentes (Open/Closed).
 *
 * Responsabilidade: decidir, dado um evento e um threshold, se a condição é satisfeita.
 * Não faz: avaliação de múltiplas condições combinadas (RuleEngine), despacho de comandos.
 */
export interface ConditionMatcher {
  /** Identificador do tipo de condição (usado pelo AlertRuleBuilder e pelo RuleEngine). */
  readonly conditionType: string;

  /**
   * Verifica se o evento satisfaz a condição para o threshold informado.
   *
   * @param event - evento de domínio a avaliar
   * @param threshold - valor limite específico da condição
   * @returns true se a condição é satisfeita
   */
  matches(event: DomainEvent, threshold: number): boolean;
}
