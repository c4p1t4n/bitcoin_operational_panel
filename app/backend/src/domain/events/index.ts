export { DomainEvent } from "./DomainEvent";

export { MemPoolFeeSpike, MEMPOOL_FEE_SPIKE } from "./MemPoolFeeSpike";
export type { MemPoolFeeSpikePayload } from "./MemPoolFeeSpike";

export { AlertTriggered, ALERT_TRIGGERED } from "./AlertTriggered";
export type { AlertTriggeredPayload } from "./AlertTriggered";

export { AlertRuleCreated, ALERT_RULE_CREATED } from "./AlertRuleCreated";
export type { AlertRuleCreatedPayload } from "./AlertRuleCreated";

export { AlertAcknowledged, ALERT_ACKNOWLEDGED } from "./AlertAcknowledged";
export type { AlertAcknowledgedPayload } from "./AlertAcknowledged";

export { PeerConnected, PEER_CONNECTED } from "./PeerConnected";
export type { PeerConnectedPayload } from "./PeerConnected";

export { PeerDisconnected, PEER_DISCONNECTED } from "./PeerDisconnected";
export type { PeerDisconnectedPayload } from "./PeerDisconnected";

export { NewBlockMined, NEW_BLOCK_MINED } from "./NewBlockMined";
export type { NewBlockMinedPayload } from "./NewBlockMined";

export { TransactionDetected, TRANSACTION_DETECTED } from "./TransactionDetected";
export type { TransactionDetectedPayload } from "./TransactionDetected";

import { MEMPOOL_FEE_SPIKE } from "./MemPoolFeeSpike";
import { ALERT_TRIGGERED } from "./AlertTriggered";
import { ALERT_RULE_CREATED } from "./AlertRuleCreated";
import { ALERT_ACKNOWLEDGED } from "./AlertAcknowledged";
import { PEER_CONNECTED } from "./PeerConnected";
import { PEER_DISCONNECTED } from "./PeerDisconnected";
import { NEW_BLOCK_MINED } from "./NewBlockMined";
import { TRANSACTION_DETECTED } from "./TransactionDetected";

/** Todos os tipos de evento de domínio conhecidos pelo sistema — usado por consumidores que precisam subscrever a todos (ex: RuleEngine, tRPC onBitcoinNetworkEvent). */
export const ALL_DOMAIN_EVENT_TYPES = [
  MEMPOOL_FEE_SPIKE,
  ALERT_TRIGGERED,
  ALERT_RULE_CREATED,
  ALERT_ACKNOWLEDGED,
  PEER_CONNECTED,
  PEER_DISCONNECTED,
  NEW_BLOCK_MINED,
  TRANSACTION_DETECTED,
] as const;
