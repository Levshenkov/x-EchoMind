/**
 * x-EchoMind — entry point.
 * Loads config, authenticates, then runs an interactive search loop:
 *   1. Ask for a search query (e.g. $BTC, #AI, "OpenAI")
 *   2. Find the most popular tweet matching it
 *   3. Generate a reply → human approval
 *   4. Generate an original tweet → human approval
 *   5. Repeat or exit
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import chalk from 'chalk'
import { input, confirm } from '@inquirer/prompts'
import { initTwitter } from './twitter.js'
import { runSearchCycle } from './bot.js'
import { loadState } from './state.js'
import logger from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadJson(file) {
  return JSON.parse(readFileSync(path.join(__dirname, '../config', file), 'utf-8'))
}

function printBanner(settings) {
  const W = 52
  const bar     = (text = '') => chalk.cyan('│') + ' ' + text.padEnd(W - 2) + ' ' + chalk.cyan('│')
  const divLine = chalk.cyan('├' + '─'.repeat(W) + '┤')
  const topLine = chalk.cyan('┌' + '─'.repeat(W) + '┐')
  const botLine = chalk.cyan('└' + '─'.repeat(W) + '┘')

  const actions = settings.actions ?? {}
  const active  = Object.entries(actions).filter(([, v]) => v).map(([k]) => k)

  console.log()
  console.log('  ' + topLine)
  console.log('  ' + bar())
  console.log('  ' + chalk.cyan('│') + chalk.bold.cyanBright('  ✦  x-EchoMind').padEnd(W + 7) + chalk.cyan('│'))
  console.log('  ' + chalk.cyan('│') + chalk.dim('  AI-powered X bot with human approval').padEnd(W + 4) + chalk.cyan('│'))
  console.log('  ' + bar())
  console.log('  ' + divLine)
  console.log('  ' + bar(chalk.dim('Mode:     ') + chalk.cyanBright('Interactive search')))
  console.log('  ' + bar(chalk.dim('Actions:  ') + active.map(a => chalk.greenBright(a)).join(chalk.dim(' · '))))
  console.log('  ' + bar(chalk.dim('Approval: ') + chalk.greenBright('ON') + chalk.dim(' — you review every action')))
  console.log('  ' + bar())
  console.log('  ' + botLine)
  console.log()
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => { logger.info('Shutting down...'); process.exit(0) })

async function main() {
  logger.info('x-EchoMind starting up...')

  const settings = loadJson('settings.json')
  printBanner(settings)

  loadState()

  try {
    await initTwitter()
  } catch (err) {
    logger.error('Failed to load cookies:', err.message ?? err.toString())
    logger.error('Run: npm run setup — then paste your auth_token and ct0 from x.com DevTools')
    process.exit(1)
  }

  logger.info('Ready. Type a search query to begin, or Ctrl+C to quit.')

  // ── Interactive search loop ───────────────────────────────────────────────
  while (true) {
    console.log()

    let query
    try {
      query = await input({
        message: chalk.cyan('🔍 Search topic') + chalk.dim(' (e.g. $BTC, #AI, "OpenAI GPT-5"):'),
      })
    } catch {
      // Ctrl+C inside the prompt
      break
    }

    if (!query.trim()) {
      console.log(chalk.dim('  (empty — exiting)'))
      break
    }

    await runSearchCycle(query.trim(), settings)

    let again
    try {
      again = await confirm({ message: 'Search another topic?', default: true })
    } catch {
      break
    }
    if (!again) break
  }

  logger.info('Goodbye.')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
