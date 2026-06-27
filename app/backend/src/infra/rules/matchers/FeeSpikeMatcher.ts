import type { DomainEvent } from "../../../domain";
import { MEMPOOL_FEE_SPIKE, type MemPoolFeeSpikePayload } from "../../../domain/events";
import type { ConditionMatcher } from "../ConditionMatcher";

/**
 * @module FeeSpikeMatcher
 * @description Strategy que detecta picos de fee no mempool acima de um threshold percentual.
 *
 * Responsabilidade: avaliar MemPoolFeeSpike.payload.deltaPct contra o threshold da regra.
 * Não faz: avaliação de outros tipos de evento (retorna false para eles).
 */
export class FeeSpikeMatcher implements ConditionMatcher {
  readonly conditionType = "FEE_SPIKE";

  /**
   * @param event - evento a avaliar; apenas MemPoolFeeSpike pode casar
   * @param threshold - aumento percentual mínimo de fee (ex: 20 = 20%)
   * @returns true se event é MemPoolFeeSpike e deltaPct >= threshold
   */
  matches(event: DomainEvent, threshold: number): boolean {
    if (event.eventType !== MEMPOOL_FEE_SPIKE) return false;
    const payload = event.payload as MemPoolFeeSpikePayload;
    return payload.deltaPct >= threshold;
  }
}
