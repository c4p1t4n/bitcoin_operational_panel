import { randomUUID } from "node:crypto";
import { TriggerAlert, UpdatePeerStatus, type Command, type DomainEvent } from "../../domain";
import type { Rule, RuleCondition } from "./Rule";

/**
 * @module AlertRuleBuilder
 * @description Fluent builder para construir Rules a partir de condições e uma ação.
 *
 * PATTERN: Builder
 * Por que este pattern: encadeamento legível (`.whenFeeSpike(20).triggerAlert(...)`), validação
 * de cada condição no momento em que é adicionada, e falha cedo em configuração inválida.
 *
 * Responsabilidade: acumular RuleConditions e compilar a Rule final com a ação escolhida.
 * Não faz: avaliação de condições (ConditionMatcher), persistência de regras, dispatch (RuleEngine).
 */
export class AlertRuleBuilder {
  private conditions: RuleCondition[] = [];

  constructor(private readonly name: string) {}

  /**
   * Adiciona condição de pico de fee no mempool.
   * @param thresholdPercentage - aumento percentual mínimo (1-100)
   * @throws Error se threshold fora do intervalo válido
   */
  whenFeeSpike(thresholdPercentage: number): this {
    if (thresholdPercentage <= 0 || thresholdPercentage > 100) {
      throw new Error(
        `whenFeeSpike threshold must be between 1 and 100, got ${thresholdPercentage}`
      );
    }
    this.conditions.push({ type: "FEE_SPIKE", threshold: thresholdPercentage });
    return this;
  }

  /**
   * Adiciona condição de tamanho mínimo de transação.
   * @param sizeBytes - tamanho mínimo da transação em bytes (vsize)
   * @throws Error se sizeBytes não for positivo
   */
  whenTransactionSize(sizeBytes: number): this {
    if (sizeBytes <= 0) {
      throw new Error(`whenTransactionSize must be positive, got ${sizeBytes}`);
    }
    this.conditions.push({ type: "TRANSACTION_SIZE", threshold: sizeBytes });
    return this;
  }

  /**
   * Adiciona condição de contagem mínima de peers conectados.
   * @param minPeers - contagem mínima de peers exigida
   * @throws Error se minPeers for negativo
   */
  whenPeerCount(minPeers: number): this {
    if (minPeers < 0) {
      throw new Error(`whenPeerCount must be >= 0, got ${minPeers}`);
    }
    this.conditions.push({ type: "PEER_COUNT", threshold: minPeers });
    return this;
  }

  /**
   * Finaliza a regra com a ação de disparar um alerta (TriggerAlert command).
   *
   * @param ruleName - nome legível da regra, usado no título do alerta
   * @param severity - severidade do alerta gerado
   * @throws Error se nenhuma condição foi adicionada
   */
  triggerAlert(
    ruleName: string,
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  ): Rule {
    this.assertHasConditions();
    const ruleId = randomUUID();

    return {
      id: ruleId,
      name: this.name,
      active: true,
      conditions: this.conditions,
      action: {
        buildCommand: (event: DomainEvent): Command =>
          new TriggerAlert(randomUUID(), {
            ruleId,
            severity,
            title: ruleName,
            sourceEventId: event.id,
          }),
      },
    };
  }

  /**
   * Finaliza a regra com a ação de atualizar o status de conectividade de um peer.
   *
   * @param aggregateId - id do agregado Peer a atualizar (peerAddress)
   * @param connected - novo status de conectividade
   * @throws Error se nenhuma condição foi adicionada
   */
  updatePeerStatus(aggregateId: string, connected: boolean): Rule {
    this.assertHasConditions();

    return {
      id: randomUUID(),
      name: this.name,
      active: true,
      conditions: this.conditions,
      action: {
        buildCommand: (): Command => new UpdatePeerStatus(aggregateId, { connected }),
      },
    };
  }

  private assertHasConditions(): void {
    if (this.conditions.length === 0) {
      throw new Error(
        `Rule "${this.name}" has no conditions — add at least one when*() call before building`
      );
    }
  }
}
