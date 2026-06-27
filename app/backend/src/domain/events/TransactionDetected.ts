import { DomainEvent } from "./DomainEvent";

export const TRANSACTION_DETECTED = "TRANSACTION_DETECTED" as const;

export interface TransactionDetectedPayload {
  txid: string;
  vsize: number;
  feeRateSatPerVb: number;
  flaggedReason?: "LARGE_SIZE" | "HIGH_VALUE" | "RBF";
}

/** Transação grande ou suspeita foi detectada no mempool. */
export class TransactionDetected extends DomainEvent<TransactionDetectedPayload> {
  constructor(aggregateId: string, version: number, payload: TransactionDetectedPayload) {
    super(aggregateId, "Transaction", TRANSACTION_DETECTED, version, payload);
  }
}
