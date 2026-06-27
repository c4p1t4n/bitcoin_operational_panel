import type { DomainEvent } from "../../../domain";
import { TRANSACTION_DETECTED, type TransactionDetectedPayload } from "../../../domain/events";
import type { ConditionMatcher } from "../ConditionMatcher";

/**
 * @module TransactionSizeMatcher
 * @description Strategy que detecta transações com tamanho (vsize) acima de um threshold.
 *
 * Responsabilidade: avaliar TransactionDetected.payload.vsize contra o threshold da regra.
 * Não faz: avaliação de outros tipos de evento (retorna false para eles).
 */
export class TransactionSizeMatcher implements ConditionMatcher {
  readonly conditionType = "TRANSACTION_SIZE";

  /**
   * @param event - evento a avaliar; apenas TransactionDetected pode casar
   * @param threshold - tamanho mínimo da transação em bytes (vsize)
   * @returns true se event é TransactionDetected e vsize >= threshold
   */
  matches(event: DomainEvent, threshold: number): boolean {
    if (event.eventType !== TRANSACTION_DETECTED) return false;
    const payload = event.payload as TransactionDetectedPayload;
    return payload.vsize >= threshold;
  }
}
