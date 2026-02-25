/**
 * Core bot logic — the "brain" that orchestrates actions for each topic cycle.
 * Every generated action goes through approveAction() before posting.
 */
import { searchTweets, postTweet, replyToTweet, quoteTweet, likeTweet } from './twitter.js'
import { analyzeTweets, generateTweet, generateReply, generateQuoteComment } from './ai.js'
import { approveAction } from './approver.js'
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
    .filter(t => !t.isRetweet)
    .sort((a, b) => engagementScore(b) - engagementScore(a))

  logger.info(`Bot: fetched ${allTweets.length} unique tweets for "${topic.name}"`)

  if (!allTweets.length) {
    logger.warn(`Bot: no tweets found for topic "${topic.name}", skipping`)
    return
  }

  // 2. Analyze with AI
  const analysis = await analyzeTweets(allTweets, topic.name)
  logger.info(`Bot: sentiment: ${analysis.sentiment} | themes: ${analysis.themes.join(', ')}`)
  if (analysis.summary) logger.info(`Bot: summary — ${analysis.summary}`)

  const style = topic.style ?? settings.defaultStyle

  // 3. Post original tweet
  if (settings.actions?.postOriginal && topic.subjects?.length) {
    const subject = randomPick(topic.subjects)
    logger.info(`Bot: generating tweet on subject — "${subject}"`)
    const generated = await generateTweet(subject, analysis.themes, style, topic.avoid)

    if (generated) {
      const { action, text } = await approveAction({
        type: 'tweet',
        text: generated,
        topic: topic.name,
      })

      if (action === 'post') {
        try {
          const result = await postTweet(text)
          if (result?.id) markPosted(result.id)
          logger.info('Bot: original tweet posted')
          await sleep(settings.delayBetweenActions ?? 5000)
        } catch (err) {
          logger.error('Bot: failed to post original tweet:', err.message)
        }
      } else {
        logger.info('Bot: original tweet skipped by user')
      }
    }
  }

  // 4. Reply to best tweet
  if (settings.actions?.reply && analysis.topEngagementTweet) {
    const target = analysis.topEngagementTweet

    if (hasRepliedTo(target.id)) {
      logger.info(`Bot: already replied to ${target.id}, skipping`)
    } else {
      logger.info(`Bot: generating reply to @${target.author}`)
      const generated = await generateReply(target, topic.name, style)

      if (generated) {
        const { action, text } = await approveAction({
          type: 'reply',
          text: generated,
          targetTweet: target,
          topic: topic.name,
        })

        if (action === 'post') {
          try {
            await replyToTweet(text, target.id)
            markReplied(target.id)
            logger.info(`Bot: replied to @${target.author}`)
            await sleep(settings.delayBetweenActions ?? 5000)
          } catch (err) {
            logger.error('Bot: failed to reply:', err.message)
          }
        } else {
          logger.info('Bot: reply skipped by user')
        }
      }
    }
  }

  // 5. Quote-tweet a high-engagement tweet
  if (settings.actions?.quoteTweet) {
    const candidate = allTweets.find(t => !hasQuoted(t.id) && engagementScore(t) > 10)

    if (candidate) {
      logger.info(`Bot: generating quote for @${candidate.author}'s tweet`)
      const generated = await generateQuoteComment(candidate, topic.name, style)

      if (generated) {
        const { action, text } = await approveAction({
          type: 'quote',
          text: generated,
          targetTweet: candidate,
          topic: topic.name,
        })

        if (action === 'post') {
          try {
            await quoteTweet(text, candidate.id)
            markQuoted(candidate.id)
            logger.info(`Bot: quote-tweeted @${candidate.author}`)
            await sleep(settings.delayBetweenActions ?? 5000)
          } catch (err) {
            logger.error('Bot: failed to quote-tweet:', err.message)
          }
        } else {
          logger.info('Bot: quote-tweet skipped by user')
        }
      }
    }
  }

  // 6. Like top tweets (no approval needed — low risk action)
  if (settings.actions?.like) {
    const toLike = allTweets.slice(0, settings.likesPerCycle ?? 3)
    for (const tweet of toLike) {
      await likeTweet(tweet.id)
      await sleep(2000)
    }
    logger.info(`Bot: liked ${toLike.length} tweets`)
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
