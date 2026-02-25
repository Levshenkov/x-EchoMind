/**
 * Cron-based scheduler.
 * Reads the schedule from settings.json and runs topic cycles accordingly.
 */
import cron from 'node-cron'
import { runTopicCycle } from './bot.js'
import logger from './logger.js'

/**
 * Start all scheduled jobs.
 * @param {object[]} topics   - Array of topic configs
 * @param {object}   settings - Bot settings
 */
export function startScheduler(topics, settings) {
  const schedule = settings.schedule ?? '0 */2 * * *' // default: every 2 hours

  logger.info(`Scheduler: starting with cron "${schedule}" for ${topics.length} topics`)

  // Run immediately on startup (unless dryRun)
  if (settings.runOnStart !== false) {
    logger.info('Scheduler: running initial cycle on startup')
    runAllTopics(topics, settings)
  }

  cron.schedule(schedule, () => {
    logger.info('Scheduler: cron tick — starting topic cycles')
    runAllTopics(topics, settings)
  })
}

/**
 * Run cycles for all topics sequentially (to avoid rate limits).
 */
async function runAllTopics(topics, settings) {
  for (const topic of topics) {
    if (topic.enabled === false) {
      logger.info(`Scheduler: topic "${topic.name}" is disabled, skipping`)
      continue
    }
    try {
      await runTopicCycle(topic, settings)
    } catch (err) {
      logger.error(`Scheduler: unhandled error in topic "${topic.name}":`, err.message)
    }
    // Gap between topics to avoid hammering the API
    await sleep(settings.delayBetweenTopics ?? 15000)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
