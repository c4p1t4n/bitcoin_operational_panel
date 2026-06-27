/**
 * @module watch-mempool
 * @description Script manual para validar BitcoinRPCAdapter + MempoolPoller
 * contra o node real configurado em `bitcoin_node/docker-compose.yml`.
 *
 * Roda com: npm run dev:watch-mempool -w app/backend
 * Para com Ctrl+C — o handler de SIGINT chama poller.stop() antes de sair.
 */
import 'dotenv/config'
import { BitcoinRPCAdapter } from '../src/bitcoin/BitcoinRPCAdapter'
import { MempoolPoller } from '../src/bitcoin/MempoolPoller'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`variável de ambiente obrigatória ausente: ${name}`)
  return value
}

const adapter = new BitcoinRPCAdapter({
  url: requireEnv('BITCOIN_RPC_URL'),
  user: requireEnv('BITCOIN_RPC_USER'),
  password: requireEnv('BITCOIN_RPC_PASSWORD'),
})

const poller = new MempoolPoller(adapter, {
  intervalMs: Number(process.env.MEMPOOL_POLL_INTERVAL_MS ?? 5_000),
})

poller.on('tx:added', (event) => {
  console.log('[tx:added]', event.txid, `vsize=${event.entry.vsize}`)
})

poller.on('tx:removed', (event) => {
  console.log('[tx:removed]', event.txid)
})

poller.on('fee:spike', (event) => {
  console.log(
    '[fee:spike]',
    `${event.previousMinFee} -> ${event.currentMinFee} BTC/kvB (${event.deltaPct.toFixed(1)}%)`,
  )
})

poller.on('poll:error', (error) => {
  console.error('[poll:error]', error)
})

console.log(`conectando em ${process.env.BITCOIN_RPC_URL} ...`)
poller.start()
console.log('poller iniciado — aguardando eventos do mempool (Ctrl+C para sair)')

process.on('SIGINT', () => {
  console.log('\nparando poller...')
  poller.stop()
  process.exit(0)
})
