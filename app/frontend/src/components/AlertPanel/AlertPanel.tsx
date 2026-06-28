import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
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

/** Cor MUI do chip de severidade. */
const SEVERITY_COLOR = {
  CRITICAL: "error",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "default",
} as const;

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
 * @description Painel de alertas — root de um Compound Component (agora com chrome MUI).
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
      <Card variant="outlined" sx={{ height: "100%" }}>
        <CardContent>{children}</CardContent>
      </Card>
    </AlertPanelContext.Provider>
  );
}

function Header({ children }: { children: ReactNode }) {
  const { alerts } = useAlertPanelContext();
  const openCount = alerts.filter((a) => a.status === "open").length;
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ mb: 1 }}
    >
      {children}
      <Chip size="small" color="primary" variant="outlined" label={`${openCount} open`} />
    </Stack>
  );
}

function List_() {
  const { alerts } = useAlertPanelContext();
  if (alerts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No alerts yet.
      </Typography>
    );
  }
  return (
    <List dense disablePadding>
      {alerts.map((alert) => (
        <Item key={alert.alertId} alert={alert} />
      ))}
    </List>
  );
}

function Item({ alert }: { alert: AlertView }) {
  const { acknowledgingId, acknowledge } = useAlertPanelContext();
  const isAcknowledging = acknowledgingId === alert.alertId;

  return (
    <ListItem
      divider
      alignItems="flex-start"
      secondaryAction={
        alert.status === "open" ? (
          <Button
            size="small"
            variant="outlined"
            disabled={isAcknowledging}
            onClick={() => acknowledge(alert.alertId)}
          >
            {isAcknowledging ? "Acknowledging…" : "Acknowledge"}
          </Button>
        ) : (
          <Chip size="small" color="success" variant="outlined" label="Acknowledged" />
        )
      }
    >
      <ListItemText
        primary={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={600}>
              {alert.title}
            </Typography>
            <Chip size="small" color={SEVERITY_COLOR[alert.severity]} label={alert.severity} />
          </Stack>
        }
        secondary={
          alert.status === "acknowledged" && alert.acknowledgedByUserId
            ? `Acknowledged by ${alert.acknowledgedByUserId}`
            : alert.description
        }
      />
    </ListItem>
  );
}

export const AlertPanel = Object.assign(AlertPanelRoot, { Header, List: List_, Item });
