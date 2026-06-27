/**
 * @module bitcoin.types
 * @description Tipos fortes para as respostas JSON-RPC do Bitcoin Core que o
 * BitcoinRPCAdapter consome.
 *
 * Responsabilidade: descrever o shape exato que o node retorna.
 * Não faz: remodelar nomes de campo para convenções do domínio — isso é
 * responsabilidade da camada de domínio (feature futura), não desta camada.
 *
 * Shapes confirmados contra um node real (Bitcoin Core 24.0.1, pruned, via
 * `bitcoin_node/docker-compose.yml`) e contra a documentação oficial da RPC.
 */

/** Rede que o node está servindo (retornado em `chain` de getblockchaininfo). */
export type BitcoinChain = 'main' | 'test' | 'testnet4' | 'signet' | 'regtest'

/** Resposta de `getblockchaininfo`. */
export interface BlockchainInfo {
  chain: BitcoinChain
  blocks: number
  headers: number
  bestblockhash: string
  difficulty: number
  time: number
  mediantime: number
  verificationprogress: number
  initialblockdownload: boolean
  chainwork: string
  size_on_disk: number
  pruned: boolean
  pruneheight?: number
  automatic_pruning?: boolean
  prune_target_size?: number
  warnings: string
}

/** Resposta de `getmempoolinfo`. */
export interface MempoolInfo {
  loaded: boolean
  size: number
  bytes: number
  usage: number
  total_fee: number
  maxmempool: number
  mempoolminfee: number
  minrelaytxfee: number
  incrementalrelayfee: number
  unbroadcastcount: number
  fullrbf: boolean
}

/** Breakdown de fee de uma entrada do mempool, em BTC. */
export interface MempoolEntryFees {
  base: number
  modified: number
  ancestor: number
  descendant: number
}

/**
 * Uma entrada de `getrawmempool` com `verbose: true`.
 * Os nomes de campo seguem exatamente o que o Bitcoin Core retorna, incluindo
 * a chave `bip125-replaceable` (não é um typo — é o nome real do campo).
 */
export interface MempoolEntry {
  vsize: number
  weight: number
  time: number
  height: number
  descendantcount: number
  descendantsize: number
  ancestorcount: number
  ancestorsize: number
  wtxid: string
  fees: MempoolEntryFees
  depends: string[]
  spentby: string[]
  'bip125-replaceable': boolean
  unbroadcast: boolean
}

/** Resposta de `estimatesmartfee`. `feerate` (BTC/kvB) ausente quando há dados insuficientes. */
export interface FeeEstimate {
  feerate?: number
  errors?: string[]
  blocks: number
}

/** Envelope de requisição JSON-RPC 1.0 usado pelo Bitcoin Core. */
export interface BitcoinRPCRequest {
  jsonrpc: '1.0'
  id: string
  method: string
  params: unknown[]
}

/** Envelope de resposta JSON-RPC do Bitcoin Core. */
export interface BitcoinRPCResponse<T> {
  result: T | null
  error: { code: number; message: string } | null
  id: string
}

/** Configuração de conexão do adapter com o node. */
export interface BitcoinRPCConfig {
  url: string
  user: string
  password: string
  /** Timeout por chamada, em ms. */
  timeoutMs?: number
}
