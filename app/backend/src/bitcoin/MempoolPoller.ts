/**
 * @module MempoolPoller
 * @description Observa o mempool do node e emite eventos quando ele muda.
 *
 * PATTERN: Observer (via EventEmitter, herdado de BasePoller) + Template Method
 * Por que este pattern: quem precisa reagir a mudanças no mempool (event store,
 * regras de alerta, frontend) não deveria conhecer a lógica de polling — só assina
 * os eventos.
 *
 * Responsabilidade: comparar o snapshot atual do mempool com o anterior e emitir
 * `tx:added`, `tx:removed` e `fee:spike`.
 * Não faz: persistir, publicar em fila/WebSocket ou decidir regra de alerta —
 * cada um desses é responsabilidade de outra classe que escuta estes eventos (SRP).
 *
 * Dependências injetadas:
 * - BitcoinRPCClient: fonte dos dados do mempool (real ou mock nos testes)
 */
import { BasePoller, type BasePollerOptions } from './BasePoller'
import type { BitcoinRPCClient } from './BitcoinRPCAdapter'
import type { MempoolEntry } from './bitcoin.types'

export interface MempoolPollerOptions extends BasePollerOptions {
  /** Variação percentual de `mempoolminfee` entre polls para considerar um spike. */
  feeSpikeThresholdPct?: number
}

export interface MempoolTxAddedEvent {
  txid: string
  entry: MempoolEntry
}

export interface MempoolTxRemovedEvent {
  txid: string
}

export interface MempoolFeeSpikeEvent {
  previousMinFee: number
  currentMinFee: number
  deltaPct: number
}

const DEFAULT_FEE_SPIKE_THRESHOLD_PCT = 20

export class MempoolPoller extends BasePoller {
  private readonly feeSpikeThresholdPct: number
  private previousMempool: Map<string, MempoolEntry> = new Map()
  private previousMinFee = 0

  constructor(
    private readonly rpc: BitcoinRPCClient,
    options: MempoolPollerOptions = {},
  ) {
    super(options)
    this.feeSpikeThresholdPct = options.feeSpikeThresholdPct ?? DEFAULT_FEE_SPIKE_THRESHOLD_PCT
  }

  /**
   * Busca o snapshot atual do mempool, emite os eventos de diff e guarda o
   * snapshot para a próxima comparação.
   *
   * No primeiro poll, `previousMempool` está vazio, então toda transação
   * presente é emitida como `tx:added` — é o snapshot inicial, não uma
   * detecção de novidade.
   */
  protected async poll(): Promise<void> {
    const [currentMempool, mempoolInfo] = await Promise.all([
      this.rpc.getRawMempool(),
      this.rpc.getMempoolInfo(),
    ])

    this.emitMempoolDiff(currentMempool)
    this.emitFeeSpikeIfAny(mempoolInfo.mempoolminfee)

    this.previousMempool = currentMempool
    this.previousMinFee = mempoolInfo.mempoolminfee
  }

  private emitMempoolDiff(currentMempool: Map<string, MempoolEntry>): void {
    for (const [txid, entry] of currentMempool) {
      if (!this.previousMempool.has(txid)) {
        this.emit('tx:added', { txid, entry } satisfies MempoolTxAddedEvent)
      }
    }
    for (const txid of this.previousMempool.keys()) {
      if (!currentMempool.has(txid)) {
        this.emit('tx:removed', { txid } satisfies MempoolTxRemovedEvent)
      }
    }
  }

  private emitFeeSpikeIfAny(currentMinFee: number): void {
    if (this.previousMinFee <= 0) return

    const deltaPct = ((currentMinFee - this.previousMinFee) / this.previousMinFee) * 100
    if (deltaPct >= this.feeSpikeThresholdPct) {
      this.emit('fee:spike', {
        previousMinFee: this.previousMinFee,
        currentMinFee,
        deltaPct,
      } satisfies MempoolFeeSpikeEvent)
    }
  }
}
