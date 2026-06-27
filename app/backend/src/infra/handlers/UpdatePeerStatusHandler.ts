import type { DomainEvent } from "../../domain";
import { PeerConnected, PeerDisconnected } from "../../domain/events";
import type { UpdatePeerStatus } from "../../domain/commands";
import type { CommandHandler } from "../CommandBus";

/**
 * @module UpdatePeerStatusHandler
 * @description Handler que processa UpdatePeerStatus command.
 *
 * PATTERN: Strategy
 * Por que este pattern: strategy específica para atualização de status de peer.
 *
 * Responsabilidade: gerar PeerConnected ou PeerDisconnected baseado no payload.
 * Não faz: persistência (EventStore), query do estado atual (Phase 4+).
 */

export class UpdatePeerStatusHandler implements CommandHandler {
  readonly commandType = "UPDATE_PEER_STATUS";

  /**
   * Processa atualização de status de connectividade de um peer.
   * Gera PeerConnected se connected=true, PeerDisconnected se false.
   *
   * @param command - UpdatePeerStatus command com aggregateId = peerAddress
   * @returns array com um PeerConnected ou PeerDisconnected event
   */
  async handle(command: UpdatePeerStatus): Promise<DomainEvent[]> {
    if (command.payload.connected) {
      const event = new PeerConnected(command.aggregateId, 1, {
        peerAddress: command.aggregateId,
        version: command.payload.version,
      });
      return [event];
    } else {
      const event = new PeerDisconnected(command.aggregateId, 1, {
        peerAddress: command.aggregateId,
      });
      return [event];
    }
  }
}
