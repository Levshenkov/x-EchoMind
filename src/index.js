/**
 * x-EchoMind — entry point.
 * Loads config, authenticates Twitter, starts the scheduler.
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { initTwitter } from './twitter.js'
import { startScheduler } from './scheduler.js'
import { loadState } from './state.js'
import logger from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadJson(file) {
  return JSON.parse(readFileSync(path.join(__dirname, '../config', file), 'utf-8'))
}

async function main() {
  logger.info('x-EchoMind starting up...')

  const settings = loadJson('settings.json')
  const topics = loadJson('topics.json')

  if (!topics.length) {
    logger.error('No topics configured in config/topics.json — exiting')
    process.exit(1)
  }

  // Load persisted state (already-replied tweet IDs, etc.)
  loadState()

  // Authenticate with Twitter
  try {
    await initTwitter()
  } catch (err) {
    logger.error('Failed to authenticate with Twitter:', err.message)
    logger.error('Check your TWITTER_USERNAME / TWITTER_PASSWORD in .env')
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
