import { DomainEvent } from "./DomainEvent";

export const PEER_DISCONNECTED = "PEER_DISCONNECTED" as const;

export interface PeerDisconnectedPayload {
  peerAddress: string;
  reason?: string;
}

/** Peer da rede Bitcoin ficou offline. */
export class PeerDisconnected extends DomainEvent<PeerDisconnectedPayload> {
  constructor(aggregateId: string, version: number, payload: PeerDisconnectedPayload) {
    super(aggregateId, "Peer", PEER_DISCONNECTED, version, payload);
  }
}
