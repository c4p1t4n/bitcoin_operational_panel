import { DomainEvent } from "./DomainEvent";

export const NEW_BLOCK_MINED = "NEW_BLOCK_MINED" as const;

export interface NewBlockMinedPayload {
  height: number;
  hash: string;
  txCount: number;
}

/** Novo bloco foi recebido pelo node. */
export class NewBlockMined extends DomainEvent<NewBlockMinedPayload> {
  constructor(aggregateId: string, version: number, payload: NewBlockMinedPayload) {
    super(aggregateId, "Block", NEW_BLOCK_MINED, version, payload);
  }
}
