import { DomainEvent } from "./DomainEvent";

export const PEER_CONNECTED = "PEER_CONNECTED" as const;

export interface PeerConnectedPayload {
  peerAddress: string;
  version?: string;
}

/** Peer da rede Bitcoin ficou online. */
export class PeerConnected extends DomainEvent<PeerConnectedPayload> {
  constructor(aggregateId: string, version: number, payload: PeerConnectedPayload) {
    super(aggregateId, "Peer", PEER_CONNECTED, version, payload);
  }
}
