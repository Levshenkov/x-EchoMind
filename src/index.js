/**
 * x-EchoMind — entry point.
 * Loads config, authenticates Twitter, starts the scheduler.
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import chalk from 'chalk'
import { initTwitter } from './twitter.js'
import { startScheduler } from './scheduler.js'
import { loadState } from './state.js'
import logger from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadJson(file) {
  return JSON.parse(readFileSync(path.join(__dirname, '../config', file), 'utf-8'))
}

function printBanner(topics, settings) {
  const W = 52
  const line  = chalk.cyan('─'.repeat(W))
  const bar   = (text = '') => chalk.cyan('│') + ' ' + text.padEnd(W - 2) + ' ' + chalk.cyan('│')

  const title     = chalk.bold.cyanBright('  ✦  x-EchoMind')
  const subtitle  = chalk.dim('  AI-powered X bot with human approval')
  const divLine   = chalk.cyan('├' + '─'.repeat(W) + '┤')
  const topLine   = chalk.cyan('┌' + '─'.repeat(W) + '┐')
  const botLine   = chalk.cyan('└' + '─'.repeat(W) + '┘')

  const enabledTopics = topics.filter(t => t.enabled !== false)

  console.log()
  console.log('  ' + topLine)
  console.log('  ' + bar())
  console.log('  ' + chalk.cyan('│') + title.padEnd(W + 7) + chalk.cyan('│'))
  console.log('  ' + chalk.cyan('│') + subtitle.padEnd(W + 4) + chalk.cyan('│'))
  console.log('  ' + bar())
  console.log('  ' + divLine)
  console.log('  ' + bar(chalk.dim('Topics (' + enabledTopics.length + ' active):')))
  for (const t of enabledTopics) {
    console.log('  ' + bar('  ' + chalk.cyan('◆') + ' ' + chalk.white(t.name)))
  }
  console.log('  ' + bar())
  console.log('  ' + divLine)

  const actions = settings.actions ?? {}
  const active = Object.entries(actions).filter(([, v]) => v).map(([k]) => k)
  console.log('  ' + bar(chalk.dim('Actions: ') + active.map(a => chalk.greenBright(a)).join(chalk.dim(' · '))))
  console.log('  ' + bar(chalk.dim('Schedule: ') + chalk.white(settings.schedule ?? '—')))
  console.log('  ' + bar(chalk.dim('Approval: ') + chalk.greenBright('ON') + chalk.dim(' — you review every action')))
  console.log('  ' + bar())
  console.log('  ' + botLine)
  console.log()
}

async function main() {
  logger.info('x-EchoMind starting up...')

  const settings = loadJson('settings.json')
  const topics = loadJson('topics.json')

  if (!topics.length) {
    logger.error('No topics configured in config/topics.json — exiting')
    process.exit(1)
  }

  printBanner(topics, settings)

  // Load persisted state (already-replied tweet IDs, etc.)
  loadState()

  // Authenticate via browser cookies
  try {
    await initTwitter()
  } catch (err) {
    logger.error('Failed to load cookies:', err.message ?? err.toString())
    logger.error('Run: npm run setup — then paste your auth_token and ct0 from x.com DevTools')
    process.exit(1)
  }

  // Start cron scheduler
  startScheduler(topics, settings)

  logger.info('x-EchoMind is running. Press Ctrl+C to stop.')

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...')
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    logger.info('Shutting down...')
    process.exit(0)
  })
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
