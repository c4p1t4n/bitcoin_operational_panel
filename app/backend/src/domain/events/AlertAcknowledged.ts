import { DomainEvent } from "./DomainEvent";

export const ALERT_ACKNOWLEDGED = "ALERT_ACKNOWLEDGED" as const;

export interface AlertAcknowledgedPayload {
  acknowledgedByUserId: string;
  note?: string;
}

/** Usuário confirmou que tratou o alerta. */
export class AlertAcknowledged extends DomainEvent<AlertAcknowledgedPayload> {
  constructor(aggregateId: string, version: number, payload: AlertAcknowledgedPayload) {
    super(aggregateId, "Alert", ALERT_ACKNOWLEDGED, version, payload);
  }
}
