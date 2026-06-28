import { useMemo } from "react";
import { useDomainEvents } from "../../hooks/useDomainEvents";

/**
 * @module EventTimeline
 * @description Lista cronológica (mais recente primeiro) de todos os `DomainEvent`
 * recebidos pelo `WebSocketFeed` desde que a página carregou.
 *
 * Não faz: persistência/histórico anterior ao carregamento da página — não há query
 * procedure no backend para isso ainda (ver `docs/features/frontend-dashboard/plan.md`,
 * Escopo "Não inclui").
 */
export function EventTimeline() {
  const { events } = useDomainEvents();
  const ordered = useMemo(() => [...events].reverse(), [events]);

  if (ordered.length === 0) {
    return <p className="event-timeline__empty">Waiting for events...</p>;
  }

  return (
    <ol className="event-timeline">
      {ordered.map((event) => (
        <li key={event.id} className="event-timeline__item">
          <time dateTime={event.occurredAt.toISOString()}>
            {event.occurredAt.toLocaleTimeString()}
          </time>
          <span className="event-timeline__type">{event.eventType}</span>
          <span className="event-timeline__aggregate">{event.aggregateType}</span>
        </li>
      ))}
    </ol>
  );
}
