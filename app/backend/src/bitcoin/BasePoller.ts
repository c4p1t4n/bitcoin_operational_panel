/**
 * @module BasePoller
 * @description Ciclo de agendamento compartilhado por todo poller do projeto.
 *
 * PATTERN: Template Method (ciclo start/stop/schedule) + Observer (EventEmitter)
 * Por que este pattern: MempoolPoller e o futuro BlockWatcher precisam do mesmo
 * cuidado de agendamento (não sobrepor polls, parar limpo) — extrair evita duplicar
 * a mesma lógica de scheduling em cada subclasse.
 *
 * Responsabilidade: decidir QUANDO chamar `poll()` e tratar erro/parada.
 * Não faz: saber O QUE buscar ou quais eventos emitir — isso é da subclasse.
 *
 * Dependências injetadas:
 * - Nenhuma na base. Subclasses recebem as suas (ex: um BitcoinRPCClient).
 */
import { EventEmitter } from 'node:events'

export interface BasePollerOptions {
  /** Intervalo entre o fim de um poll e o início do próximo, em ms. */
  intervalMs?: number
}

const DEFAULT_INTERVAL_MS = 5_000

export abstract class BasePoller extends EventEmitter {
  private readonly intervalMs: number
  private timer: NodeJS.Timeout | null = null
  private running = false

  protected constructor(options: BasePollerOptions = {}) {
    super()
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
  }

  /**
   * Inicia o ciclo de polling. Idempotente — chamar com o poller já rodando não faz nada.
   */
  start(): void {
    if (this.running) return
    this.running = true
    this.scheduleNext(0)
  }

  /**
   * Para o ciclo. Um poll em andamento ainda termina, mas nenhum próximo é agendado.
   */
  stop(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  get isRunning(): boolean {
    return this.running
  }

  private scheduleNext(delayMs: number): void {
    this.timer = setTimeout(() => {
      void this.runOnce()
    }, delayMs)
  }

  private async runOnce(): Promise<void> {
    if (!this.running) return
    try {
      await this.poll()
    } catch (err) {
      this.emit('poll:error', err)
    } finally {
      if (this.running) this.scheduleNext(this.intervalMs)
    }
  }

  /**
   * Hook do Template Method — busca dados, faz diff e emite eventos.
   * Erros lançados aqui são capturados por `runOnce` e re-emitidos como `poll:error`.
   */
  protected abstract poll(): Promise<void>
}
