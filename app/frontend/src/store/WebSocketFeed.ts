import { normalizeDomainEvent, type DomainEventView, type DomainEventWire } from "../domain/events";
import { trpcClient, wsClient } from "../trpc/client";
import { onCurrentUserIdChange } from "../auth/currentUser";

export type ConnectionStatus = "idle" | "connecting" | "open";

export interface WebSocketFeedSnapshot {
  events: readonly DomainEventView[];
  status: ConnectionStatus;
}

const DEFAULT_MAX_BUFFER_SIZE = 500;

/**
 * @module store/WebSocketFeed
 * @description External store (fora do ciclo de vida de componentes React) que mantém um
 * buffer circular do stream `onBitcoinNetworkEvent` e o status da conexão WS.
 *
 * PATTERN: Observer (EventEmitter) + External Store (compatível com `useSyncExternalStore`)
 * Por que este pattern: o roadmap pede explicitamente um store fora do React (não
 * `@trpc/react-query`) — sobrevive a remounts de componente, e múltiplos componentes
 * (EventTimeline, AlertPanel, MempoolWidget, OperationsTable) leem o mesmo snapshot sem
 * duplicar a subscription de rede.
 *
 * Responsabilidade: abrir a subscription tRPC, acumular eventos num buffer limitado
 * (backpressure — descarta o mais antigo ao exceder o tamanho máximo), notificar
 * listeners a cada novo evento ou mudança de status, reconectar quando o usuário atual muda.
 * Não faz: renderização (componentes), parsing de payload por tipo de evento (cada
 * componente filtra o que precisa do snapshot).
 *
 * Dependências injetadas: nenhuma — usa o singleton `trpcClient`/`wsClient` do módulo
 * `trpc/client`. Poderia ser injetado via construtor para testes; não feito agora pois
 * testes não foram solicitados nesta rodada (ver plan.md).
 */
export class WebSocketFeed {
  private events: DomainEventView[] = [];
  private status: ConnectionStatus = "idle";
  /**
   * Snapshot cacheado — `useSyncExternalStore` chama `getSnapshot()` em todo render para
   * decidir se o feed mudou; se cada chamada retornasse um objeto novo, pareceria mudado
   * a cada render e causaria loop infinito. Só é recriado em `notify()`, quando o estado
   * de fato mudou.
   */
  private snapshot: WebSocketFeedSnapshot = { events: this.events, status: this.status };
  private readonly listeners = new Set<() => void>();
  private unsubscribeSubscription: (() => void) | null = null;
  private unsubscribeConnectionState: (() => void) | null = null;
  private unsubscribeUserChange: (() => void) | null = null;

  constructor(private readonly maxBufferSize: number = DEFAULT_MAX_BUFFER_SIZE) {}

  /** Contrato `useSyncExternalStore`: registra um listener, retorna a função de unsubscribe. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Contrato `useSyncExternalStore`: snapshot imutável do estado atual — referência estável entre chamadas até a próxima mudança. */
  getSnapshot = (): WebSocketFeedSnapshot => this.snapshot;

  /**
   * Abre a subscription `onBitcoinNetworkEvent` e começa a acumular eventos.
   * Reconecta automaticamente (via `WsClient`) e re-handshake quando o usuário atual muda
   * (`onCurrentUserIdChange`), já que `connectionParams` só é reavaliado em uma nova conexão.
   */
  connect(): void {
    if (this.unsubscribeSubscription) return; // já conectado

    this.subscribeToConnectionState();
    this.subscribeToEvents();

    this.unsubscribeUserChange = onCurrentUserIdChange(() => {
      this.resubscribe();
    });
  }

  /** Encerra a subscription e a conexão WS. Chamado ao desmontar a árvore React raiz. */
  disconnect(): void {
    this.unsubscribeSubscription?.();
    this.unsubscribeSubscription = null;
    this.unsubscribeConnectionState?.();
    this.unsubscribeConnectionState = null;
    this.unsubscribeUserChange?.();
    this.unsubscribeUserChange = null;
    void wsClient.close();
  }

  private subscribeToConnectionState(): void {
    const subscription = wsClient.connectionState.subscribe({
      next: (state) => {
        this.status = state.state === "pending" ? "open" : state.state;
        this.notify();
      },
    });
    this.unsubscribeConnectionState = () => subscription.unsubscribe();
  }

  private subscribeToEvents(): void {
    const subscription = trpcClient.alerts.onBitcoinNetworkEvent.subscribe(undefined, {
      onData: (event) => this.pushEvent(normalizeDomainEvent(event as DomainEventWire)),
      onError: (err) => console.error("WebSocketFeed: subscription error:", err),
    });
    this.unsubscribeSubscription = () => subscription.unsubscribe();
  }

  /** Fecha e reabre a subscription — força uma nova conexão WS com `connectionParams` atualizados. */
  private resubscribe(): void {
    this.unsubscribeSubscription?.();
    void wsClient.close().then(() => this.subscribeToEvents());
  }

  private pushEvent(event: DomainEventView): void {
    const next = [...this.events, event];
    this.events = next.length > this.maxBufferSize ? next.slice(next.length - this.maxBufferSize) : next;
    this.notify();
  }

  private notify(): void {
    this.snapshot = { events: this.events, status: this.status };
    this.listeners.forEach((listener) => listener());
  }
}

export const webSocketFeed = new WebSocketFeed();
