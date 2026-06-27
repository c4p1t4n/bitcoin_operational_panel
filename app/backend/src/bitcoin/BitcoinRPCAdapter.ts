/**
 * @module BitcoinRPCAdapter
 * @description Isola o transporte JSON-RPC HTTP do node Bitcoin Core.
 *
 * PATTERN: Adapter
 * Por que este pattern: o resto da aplicação não deveria saber que existe um
 * HTTP JSON-RPC embaixo — só conhece a interface `BitcoinRPCClient`. Trocar de
 * transporte (ex: ZMQ, unix socket) significa trocar esta classe, nada mais.
 *
 * Responsabilidade: chamar métodos RPC e devolver os tipos de bitcoin.types.ts.
 * Não faz: interpretar os dados (diff, deteção de spike) — isso é do poller.
 *
 * Dependências injetadas:
 * - BitcoinRPCConfig: URL e credenciais do node (sem isso não há como construir o adapter)
 */
import type {
  BitcoinRPCConfig,
  BitcoinRPCRequest,
  BitcoinRPCResponse,
  BlockchainInfo,
  FeeEstimate,
  MempoolEntry,
  MempoolInfo,
} from './bitcoin.types'

/**
 * Contrato que o resto do sistema depende — não a classe concreta.
 * Permite substituir por um mock nos testes sem checar `instanceof` em lugar nenhum.
 */
export interface BitcoinRPCClient {
  getBlockchainInfo(): Promise<BlockchainInfo>
  getMempoolInfo(): Promise<MempoolInfo>
  getRawMempool(): Promise<Map<string, MempoolEntry>>
  estimateSmartFee(targetBlocks: number): Promise<FeeEstimate>
}

/** Erro tipado para qualquer falha de transporte ou de RPC do node. */
export class BitcoinRPCError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message)
    this.name = 'BitcoinRPCError'
  }
}

const DEFAULT_TIMEOUT_MS = 10_000
const RPC_REQUEST_ID = 'bitcoin-ops-panel'

export class BitcoinRPCAdapter implements BitcoinRPCClient {
  constructor(private readonly config: BitcoinRPCConfig) {}

  /**
   * Busca o estado da chain (altura, sync, pruning).
   * @throws BitcoinRPCError quando o node está inacessível ou retorna erro
   */
  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.call<BlockchainInfo>('getblockchaininfo')
  }

  /**
   * Busca o resumo agregado do mempool (tamanho, fee mínima de relay).
   * @throws BitcoinRPCError quando o node está inacessível ou retorna erro
   */
  async getMempoolInfo(): Promise<MempoolInfo> {
    return this.call<MempoolInfo>('getmempoolinfo')
  }

  /**
   * Busca todas as transações do mempool com detalhe (verbose).
   * @returns Map de txid para a entrada — preferido sobre um objeto de chaves dinâmicas
   * @throws BitcoinRPCError quando o node está inacessível ou retorna erro
   */
  async getRawMempool(): Promise<Map<string, MempoolEntry>> {
    const verbose = await this.call<Record<string, MempoolEntry>>('getrawmempool', [true])
    return new Map(Object.entries(verbose))
  }

  /**
   * Estima a fee rate para confirmar dentro de `targetBlocks` blocos.
   * @param targetBlocks - horizonte de confirmação desejado, em blocos
   * @throws BitcoinRPCError quando o node está inacessível ou retorna erro
   */
  async estimateSmartFee(targetBlocks: number): Promise<FeeEstimate> {
    return this.call<FeeEstimate>('estimatesmartfee', [targetBlocks])
  }

  /**
   * Executa uma chamada JSON-RPC 1.0 contra o node e desembrulha o envelope de resposta.
   * @throws BitcoinRPCError em falha de rede, timeout, HTTP não-2xx ou `error` no envelope
   */
  private async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const body: BitcoinRPCRequest = { jsonrpc: '1.0', id: RPC_REQUEST_ID, method, params }
    const auth = Buffer.from(`${this.config.user}:${this.config.password}`).toString('base64')
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    )

    let response: Response
    try {
      response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      throw new BitcoinRPCError(`falha ao conectar ao node: ${(err as Error).message}`, -1)
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      throw new BitcoinRPCError(`node respondeu HTTP ${response.status}`, response.status)
    }

    const payload = (await response.json()) as BitcoinRPCResponse<T>
    if (payload.error) {
      throw new BitcoinRPCError(payload.error.message, payload.error.code)
    }
    if (payload.result === null) {
      throw new BitcoinRPCError(`resposta vazia para o método "${method}"`, -1)
    }
    return payload.result
  }
}
