/**
 * Inbox entrypoint — fetches mentions of BOT_HANDLE that are newer than the
 * saved cursor and runs each through the persona-driven reply + approval flow.
 *
 * Run with: npm run inbox
 *
 * One pass per invocation; exits when the queue is processed. Run periodically
 * (cron, launchd, or just by hand) to keep the inbound conversation alive.
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import chalk from 'chalk'
import { initTwitter } from './twitter.js'
import { runInboundCycle } from './bot.js'
import { loadState } from './state.js'
import logger from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadSettings() {
  return JSON.parse(readFileSync(path.join(__dirname, '../config/settings.json'), 'utf-8'))
}

async function main() {
  logger.info('x-EchoMind inbox starting...')

  const handle = (process.env.BOT_HANDLE ?? '').replace(/^@/, '').trim()
  if (!handle) {
    console.error(chalk.red('Missing BOT_HANDLE in .env'))
    console.error(chalk.dim('Set your X username (without @) and try again.'))
    process.exit(1)
  }

  const settings = loadSettings()
  loadState()

  try {
    await initTwitter()
  } catch (err) {
    logger.error('Failed to load cookies:', err.message ?? err.toString())
    logger.error('Run: npm run setup — then paste your auth_token and ct0 from x.com DevTools')
    process.exit(1)
  }

  console.log()
  console.log(chalk.cyan(`✦ Inbox for @${handle}`))
  console.log()

  await runInboundCycle({ handle, settings })

  logger.info('Inbox: done.')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
