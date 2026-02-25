/**
 * Core bot logic — the "brain" that orchestrates actions for each topic cycle.
 */
import { searchTweets, postTweet, replyToTweet, quoteTweet, likeTweet } from './twitter.js'
import { analyzeTweets, generateTweet, generateReply, generateQuoteComment } from './ai.js'
import { hasRepliedTo, hasQuoted, markReplied, markQuoted, markPosted } from './state.js'
import logger from './logger.js'

/**
 * Run a full analysis + engagement cycle for one topic.
 * @param {object} topic    - Topic config object from topics.json
 * @param {object} settings - Bot settings
 */
export async function runTopicCycle(topic, settings) {
  logger.info(`Bot: starting cycle for topic "${topic.name}"`)

  // 1. Fetch top tweets for this topic
  const queries = topic.searchQueries ?? [topic.name]
  let allTweets = []

  for (const query of queries) {
    const tweets = await searchTweets(query, settings.tweetsPerSearch ?? 20, 'top')
    allTweets.push(...tweets)
  }

  // Deduplicate by ID, sort by engagement score
  const seen = new Set()
  allTweets = allTweets
    .filter(t => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    .filter(t => !t.isRetweet) // skip plain retweets
    .sort((a, b) => engagementScore(b) - engagementScore(a))

  logger.info(`Bot: fetched ${allTweets.length} unique tweets for "${topic.name}"`)

  if (!allTweets.length) {
    logger.warn(`Bot: no tweets found for topic "${topic.name}", skipping`)
    return
  }

  // 2. Analyze with AI
  const analysis = await analyzeTweets(allTweets, topic.name)
  logger.info(`Bot: analysis — sentiment: ${analysis.sentiment}, themes: ${analysis.themes.join(', ')}`)

  // 3. Post original tweet (if enabled and we have subjects)
  if (settings.actions?.postOriginal && topic.subjects?.length) {
    const subject = randomPick(topic.subjects)
    const text = await generateTweet(subject, analysis.themes, topic.style ?? settings.defaultStyle, topic.avoid)
    if (text) {
      if (settings.dryRun) {
        logger.info(`[DRY RUN] Would post: "${text}"`)
      } else {
        try {
          const result = await postTweet(text)
          if (result?.id) markPosted(result.id)
          await sleep(settings.delayBetweenActions ?? 5000)
        } catch (err) {
          logger.error('Bot: failed to post original tweet:', err.message)
        }
      }
    }
  }

  // 4. Reply to best tweet (if enabled)
  if (settings.actions?.reply && analysis.topEngagementTweet) {
    const target = analysis.topEngagementTweet
    if (!hasRepliedTo(target.id)) {
      const reply = await generateReply(target, topic.name, topic.style ?? settings.defaultStyle)
      if (reply) {
        if (settings.dryRun) {
          logger.info(`[DRY RUN] Would reply to @${target.author}: "${reply}"`)
        } else {
          try {
            await replyToTweet(reply, target.id)
            markReplied(target.id)
            await sleep(settings.delayBetweenActions ?? 5000)
          } catch (err) {
            logger.error('Bot: failed to reply:', err.message)
          }
        }
      }
    } else {
      logger.info(`Bot: already replied to ${target.id}, skipping`)
    }
  }

  // 5. Quote-tweet a high-engagement tweet (if enabled)
  if (settings.actions?.quoteTweet) {
    // Pick a high-engagement tweet we haven't quoted yet
    const candidate = allTweets.find(t => !hasQuoted(t.id) && engagementScore(t) > 10)
    if (candidate) {
      const comment = await generateQuoteComment(candidate, topic.name, topic.style ?? settings.defaultStyle)
      if (comment) {
        if (settings.dryRun) {
          logger.info(`[DRY RUN] Would quote @${candidate.author}: "${comment}"`)
        } else {
          try {
            await quoteTweet(comment, candidate.id)
            markQuoted(candidate.id)
            await sleep(settings.delayBetweenActions ?? 5000)
          } catch (err) {
            logger.error('Bot: failed to quote-tweet:', err.message)
          }
        }
      }
    }
  }

  // 6. Like top tweets (if enabled)
  if (settings.actions?.like) {
    const toLike = allTweets.slice(0, settings.likesPerCycle ?? 3)
    for (const tweet of toLike) {
      if (settings.dryRun) {
        logger.info(`[DRY RUN] Would like tweet by @${tweet.author}`)
      } else {
        await likeTweet(tweet.id)
        await sleep(2000)
      }
    }
  }

  logger.info(`Bot: cycle complete for "${topic.name}"`)
}

function engagementScore(tweet) {
  return (tweet.likes ?? 0) + (tweet.retweets ?? 0) * 2 + (tweet.replies ?? 0) * 1.5
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
