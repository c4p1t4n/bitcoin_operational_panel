import type { DomainEvent } from "../../../domain";
import { PEER_CONNECTED, PEER_DISCONNECTED } from "../../../domain/events";
import type { ConditionMatcher } from "../ConditionMatcher";

/**
 * @module PeerCountMatcher
 * @description Strategy que detecta queda na contagem de peers conectados abaixo de um threshold.
 *
 * PATTERN: Strategy (com estado interno)
 * Por que mantém estado: PeerConnected/PeerDisconnected carregam apenas o peer individual
 * afetado, não uma contagem agregada. O matcher mantém um contador interno, incrementado em
 * PeerConnected e decrementado em PeerDisconnected, para saber a contagem corrente.
 *
 * Responsabilidade: rastrear contagem de peers conectados e avaliar contra o threshold mínimo.
 * Não faz: persistência da contagem entre reinicializações do processo (Phase 5+ pode mover
 * este estado para Redis/Postgres).
 */
export class PeerCountMatcher implements ConditionMatcher {
  readonly conditionType = "PEER_COUNT";
  private connectedPeers = 0;

  /**
   * @param event - evento a avaliar; apenas PeerConnected/PeerDisconnected atualizam o contador
   * @param threshold - contagem mínima de peers exigida
   * @returns true se, após processar o evento, a contagem de peers é menor que o threshold
   */
  matches(event: DomainEvent, threshold: number): boolean {
    if (event.eventType === PEER_CONNECTED) {
      this.connectedPeers += 1;
    } else if (event.eventType === PEER_DISCONNECTED) {
      this.connectedPeers = Math.max(0, this.connectedPeers - 1);
    } else {
      return false;
    }

    return this.connectedPeers < threshold;
  }
}
