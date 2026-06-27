import type { Command, DomainEvent } from "../../domain";

/**
 * @module Rule
 * @description Tipos que representam uma regra de alerta compilada: condições + ação.
 *
 * Responsabilidade: vocabulário mínimo usado pelo RuleEngine e pelo AlertRuleBuilder para
 * representar "quando X e Y, faça Z".
 * Não faz: avaliação (RuleEngine), construção (AlertRuleBuilder), persistência.
 */

/** Uma condição individual dentro de uma regra — tipo + valor limite. */
export interface RuleCondition {
  readonly type: string;
  readonly threshold: number;
}

/**
 * Ação disparada quando todas as condições de uma regra são satisfeitas.
 * `buildCommand` recebe o evento que disparou a regra para que o command gerado
 * possa referenciar dados do evento (ex: sourceEventId).
 */
export interface RuleAction {
  buildCommand(event: DomainEvent): Command;
}

/** Regra compilada: identidade, condições (AND lógico) e ação. */
export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly conditions: RuleCondition[];
  readonly action: RuleAction;
}
