import { AlertRuleBuilder } from "./AlertRuleBuilder";
import type { Rule } from "./Rule";
import type { RuleDefinitionRow } from "./RuleDefinitionRepository";

/**
 * @module RuleDefinitionCompiler
 * @description Converte uma row de `rule_definitions` (JSONB `configuration`) numa `Rule`
 * compilada, pronta para `RuleEngine.addRule()`.
 *
 * PATTERN: Adapter
 * Por que este pattern: adapta o formato de persistência (JSON livre, vindo do Postgres)
 * para o vocabulário fortemente tipado que `AlertRuleBuilder`/`RuleEngine` esperam, sem
 * que nenhum dos dois precise conhecer o formato de armazenamento.
 *
 * Responsabilidade: validar e traduzir `configuration.conditions` + `configuration.action`
 * em chamadas ao `AlertRuleBuilder`.
 * Não faz: persistência (RuleDefinitionRepository), avaliação de condições (ConditionMatcher).
 */

interface RuleConfiguration {
  conditions: Array<{ type: string; threshold: number }>;
  action:
    | { kind: "TRIGGER_ALERT"; title: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }
    | { kind: "UPDATE_PEER_STATUS"; aggregateId: string; connected: boolean };
}

export class RuleDefinitionCompilationError extends Error {
  constructor(ruleName: string, reason: string) {
    super(`Cannot compile rule "${ruleName}": ${reason}`);
    this.name = "RuleDefinitionCompilationError";
  }
}

export class RuleDefinitionCompiler {
  /**
   * Compila uma row em `Rule`.
   *
   * @param row - row de `rule_definitions`
   * @returns Rule pronta para `RuleEngine.addRule()`
   * @throws RuleDefinitionCompilationError - se `configuration` é malformada ou `action.kind`
   * desconhecido
   */
  compile(row: RuleDefinitionRow): Rule {
    const config = this.parseConfiguration(row);

    const builder = new AlertRuleBuilder(row.name);
    for (const condition of config.conditions) {
      this.applyCondition(builder, row.name, condition);
    }

    switch (config.action.kind) {
      case "TRIGGER_ALERT":
        return builder.triggerAlert(config.action.title, config.action.severity);
      case "UPDATE_PEER_STATUS":
        return builder.updatePeerStatus(config.action.aggregateId, config.action.connected);
      default:
        throw new RuleDefinitionCompilationError(
          row.name,
          `unknown action.kind "${(config.action as { kind: string }).kind}"`
        );
    }
  }

  private parseConfiguration(row: RuleDefinitionRow): RuleConfiguration {
    const { conditions, action } = row.configuration as Partial<RuleConfiguration>;

    if (!Array.isArray(conditions) || conditions.length === 0) {
      throw new RuleDefinitionCompilationError(row.name, "configuration.conditions must be a non-empty array");
    }
    if (!action || typeof action !== "object") {
      throw new RuleDefinitionCompilationError(row.name, "configuration.action is required");
    }

    return { conditions, action } as RuleConfiguration;
  }

  private applyCondition(
    builder: AlertRuleBuilder,
    ruleName: string,
    condition: { type: string; threshold: number }
  ): void {
    switch (condition.type) {
      case "FEE_SPIKE":
        builder.whenFeeSpike(condition.threshold);
        break;
      case "TRANSACTION_SIZE":
        builder.whenTransactionSize(condition.threshold);
        break;
      case "PEER_COUNT":
        builder.whenPeerCount(condition.threshold);
        break;
      default:
        throw new RuleDefinitionCompilationError(ruleName, `unknown condition.type "${condition.type}"`);
    }
  }
}
