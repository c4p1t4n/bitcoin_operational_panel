import { DomainEvent } from "./DomainEvent";

export const MEMPOOL_FEE_SPIKE = "MEMPOOL_FEE_SPIKE" as const;

export interface MemPoolFeeSpikePayload {
  feeRateSatPerVb: number;
  baselineSatPerVb: number;
  deltaPct: number;
}

/** Taxa de fee do mempool excedeu a baseline configurada. */
export class MemPoolFeeSpike extends DomainEvent<MemPoolFeeSpikePayload> {
  constructor(aggregateId: string, version: number, payload: MemPoolFeeSpikePayload) {
    super(aggregateId, "Transaction", MEMPOOL_FEE_SPIKE, version, payload);
  }
}
