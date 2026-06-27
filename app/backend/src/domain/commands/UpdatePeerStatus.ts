import { Command } from "./Command";

export const UPDATE_PEER_STATUS = "UPDATE_PEER_STATUS" as const;

export interface UpdatePeerStatusPayload {
  connected: boolean;
  version?: string;
  banScore?: number;
}

/** Solicita a atualização do estado de conectividade de um peer. */
export class UpdatePeerStatus extends Command<UpdatePeerStatusPayload> {
  constructor(aggregateId: string, payload: UpdatePeerStatusPayload) {
    super(aggregateId, UPDATE_PEER_STATUS, payload);
  }
}
