import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  ALERT_TRIGGERED,
  ALERT_ACKNOWLEDGED,
  type AlertTriggeredPayload,
  type AlertAcknowledgedPayload,
} from "../../domain/events";
import { useDomainEvents } from "../../hooks/useDomainEvents";
import { trpcClient } from "../../trpc/client";

export interface AlertView extends AlertTriggeredPayload {
  alertId: string;
  occurredAt: Date;
  status: "open" | "acknowledged";
  acknowledgedByUserId?: string;
  note?: string;
}

interface AlertPanelContextValue {
  alerts: AlertView[];
  acknowledgingId: string | null;
  acknowledge: (alertId: string, note?: string) => Promise<void>;
}

const AlertPanelContext = createContext<AlertPanelContextValue | null>(null);

function useAlertPanelContext(): AlertPanelContextValue {
  const ctx = useContext(AlertPanelContext);
  if (!ctx) throw new Error("AlertPanel.* must be rendered inside <AlertPanel>");
  return ctx;
}

/**
 * Reconstrói a lista de alertas a partir do buffer de eventos do `WebSocketFeed`:
 * `AlertTriggered` cria a entrada, `AlertAcknowledged` (mesmo `aggregateId` = alertId) a marca confirmada.
 */
function deriveAlerts(events: ReturnType<typeof useDomainEvents>["events"]): AlertView[] {
  const byId = new Map<string, AlertView>();

  for (const event of events) {
    if (event.eventType === ALERT_TRIGGERED) {
      const payload = event.payload as AlertTriggeredPayload;
      byId.set(event.aggregateId, {
        ...payload,
        alertId: event.aggregateId,
        occurredAt: event.occurredAt,
        status: "open",
      });
    } else if (event.eventType === ALERT_ACKNOWLEDGED) {
      const existing = byId.get(event.aggregateId);
      if (existing) {
        const payload = event.payload as AlertAcknowledgedPayload;
        byId.set(event.aggregateId, {
          ...existing,
          status: "acknowledged",
          acknowledgedByUserId: payload.acknowledgedByUserId,
          note: payload.note,
        });
      }
    }
  }

  return [...byId.values()].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

/**
 * @module AlertPanel
 * @description Painel de alertas — root de um Compound Component.
 *
 * PATTERN: Compound Component
 * Por que este pattern: `AlertPanel.Header`/`List`/`Item` compartilham estado (lista de
 * alertas, qual está sendo confirmado) via Context, sem que o consumidor precise passar
 * tudo por props — `<AlertPanel><AlertPanel.Header/><AlertPanel.List/></AlertPanel>` lê
 * naturalmente, e cada parte permanece testável/substituível isoladamente (Liskov/Interface
 * Segregation: quem só quer a lista usa só `AlertPanel.List`).
 *
 * Não faz: fetch de dados (lê do `WebSocketFeed` via `useDomainEvents`), validação de
 * permissão (PermissionSpec, aplicada no backend via CommandBus).
 */
function AlertPanelRoot({ children }: { children: ReactNode }) {
  const { events } = useDomainEvents();
  const alerts = useMemo(() => deriveAlerts(events), [events]);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const acknowledge = async (alertId: string, note?: string): Promise<void> => {
    setAcknowledgingId(alertId);
    try {
      await trpcClient.alerts.acknowledgeAlert.mutate({ alertId, note });
    } finally {
      setAcknowledgingId(null);
    }
  };

  return (
    <AlertPanelContext.Provider value={{ alerts, acknowledgingId, acknowledge }}>
      <section className="alert-panel">{children}</section>
    </AlertPanelContext.Provider>
  );
}

function Header({ children }: { children: ReactNode }) {
  const { alerts } = useAlertPanelContext();
  const openCount = alerts.filter((a) => a.status === "open").length;
  return (
    <header className="alert-panel__header">
      {children}
      <span className="alert-panel__count">{openCount} open</span>
    </header>
  );
}

function List() {
  const { alerts } = useAlertPanelContext();
  if (alerts.length === 0) {
    return <p className="alert-panel__empty">No alerts yet.</p>;
  }
  return (
    <ul className="alert-panel__list">
      {alerts.map((alert) => (
        <Item key={alert.alertId} alert={alert} />
      ))}
    </ul>
  );
}

function Item({ alert }: { alert: AlertView }) {
  const { acknowledgingId, acknowledge } = useAlertPanelContext();
  const isAcknowledging = acknowledgingId === alert.alertId;

  return (
    <li className={`alert-panel__item alert-panel__item--${alert.severity.toLowerCase()}`}>
      <strong>{alert.title}</strong>
      <span className="alert-panel__severity">{alert.severity}</span>
      {alert.description && <p>{alert.description}</p>}
      {alert.status === "open" ? (
        <button disabled={isAcknowledging} onClick={() => acknowledge(alert.alertId)}>
          {isAcknowledging ? "Acknowledging..." : "Acknowledge"}
        </button>
      ) : (
        <span className="alert-panel__acknowledged">
          Acknowledged{alert.acknowledgedByUserId ? ` by ${alert.acknowledgedByUserId}` : ""}
        </span>
      )}
    </li>
  );
}

export const AlertPanel = Object.assign(AlertPanelRoot, { Header, List, Item });
