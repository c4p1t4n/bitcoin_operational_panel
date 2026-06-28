import { useMemo } from "react";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useDomainEvents } from "../../hooks/useDomainEvents";

/**
 * @module EventTimeline
 * @description Lista cronológica (mais recente primeiro) de todos os `DomainEvent`
 * recebidos pelo `WebSocketFeed` desde que a página carregou.
 *
 * Não faz: persistência/histórico anterior ao carregamento da página — isso é
 * responsabilidade do `EventHistoryTable` (ver `docs/features/event-history-table/plan.md`).
 */
export function EventTimeline() {
  const { events } = useDomainEvents();
  const ordered = useMemo(() => [...events].reverse(), [events]);

  if (ordered.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Waiting for events…
      </Typography>
    );
  }

  return (
    <Box sx={{ maxHeight: 320, overflowY: "auto" }}>
      <List dense disablePadding>
        {ordered.map((event) => (
          <ListItem
            key={event.id}
            divider
            secondaryAction={<Chip size="small" label={event.aggregateType} variant="outlined" />}
          >
            <ListItemText
              primary={event.eventType}
              secondary={
                <time dateTime={event.occurredAt.toISOString()}>
                  {event.occurredAt.toLocaleTimeString()}
                </time>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
