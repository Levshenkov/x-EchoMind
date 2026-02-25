/**
 * Core bot logic — orchestrates the topic cycle.
 * Every generated action goes through approveAction().
 * If the user picks "Change tone", we regenerate and show again.
 */
import { getAccountTweets, postTweet, replyToTweet, quoteTweet, likeTweet } from './twitter.js'
import { analyzeTweets, generateTweet, generateReply, generateQuoteComment } from './ai.js'
import { approveAction } from './approver.js'
import { hasRepliedTo, hasQuoted, markReplied, markQuoted, markPosted } from './state.js'
import logger from './logger.js'

export async function runTopicCycle(topic, settings) {
  logger.info(`Bot: starting cycle for topic "${topic.name}"`)

  // 1. Fetch top tweets from curated accounts
  const accounts = topic.accounts ?? []
  let allTweets = []

  for (const account of accounts) {
    const tweets = await getAccountTweets(account, settings.tweetsPerSearch ?? 20)
    allTweets.push(...tweets)
  }

  const seen = new Set()
  allTweets = allTweets
    .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
    .filter(t => !t.isRetweet)
    .sort((a, b) => engagementScore(b) - engagementScore(a))

  logger.info(`Bot: fetched ${allTweets.length} unique tweets for "${topic.name}"`)
  if (!allTweets.length) { logger.warn(`Bot: no tweets found for "${topic.name}"`); return }

  // 2. Analyze
  const analysis = await analyzeTweets(allTweets, topic.name)
  logger.info(`Bot: sentiment: ${analysis.sentiment} | themes: ${analysis.themes.join(', ')}`)

  const style = topic.style ?? settings.defaultStyle

  // 3. Post original tweet
  if (settings.actions?.postOriginal && topic.subjects?.length) {
    const subject = randomPick(topic.subjects)
    logger.info(`Bot: generating tweet — "${subject}"`)

    let tone = null
    let text = await generateTweet(subject, analysis.themes, style, topic.avoid, tone)

    if (text) {
      let result
      do {
        result = await approveAction({ type: 'tweet', text, topic: topic.name, tone })
        if (result.action === 'regenerate') {
          tone = result.tone
          text = await generateTweet(subject, analysis.themes, style, topic.avoid, tone)
          if (!text) { result = { action: 'skip', text: '' }; break }
        }
      } while (result.action === 'regenerate')

      if (result.action === 'post') {
        try {
          const res = await postTweet(result.text)
          if (res?.id) markPosted(res.id)
          logger.info('Bot: original tweet posted')
          await sleep(settings.delayBetweenActions ?? 5000)
        } catch (err) { logger.error('Bot: post failed:', err.message) }
      }
    }
  }

  // 4. Reply to best tweet
  if (settings.actions?.reply && analysis.topEngagementTweet) {
    const target = analysis.topEngagementTweet

    if (hasRepliedTo(target.id)) {
      logger.info(`Bot: already replied to ${target.id}`)
    } else {
      logger.info(`Bot: generating reply to @${target.author}`)

      let tone = null
      let text = await generateReply(target, topic.name, style, tone)

      if (text) {
        let result
        do {
          result = await approveAction({ type: 'reply', text, targetTweet: target, topic: topic.name, tone })
          if (result.action === 'regenerate') {
            tone = result.tone
            text = await generateReply(target, topic.name, style, tone)
            if (!text) { result = { action: 'skip', text: '' }; break }
          }
        } while (result.action === 'regenerate')

        if (result.action === 'post') {
          try {
            await replyToTweet(result.text, target.id)
            markReplied(target.id)
            logger.info(`Bot: replied to @${target.author}`)
            await sleep(settings.delayBetweenActions ?? 5000)
          } catch (err) { logger.error('Bot: reply failed:', err.message) }
        }
      }
    }
  }

  // 5. Quote-tweet
  if (settings.actions?.quoteTweet) {
    const candidate = allTweets.find(t => !hasQuoted(t.id) && engagementScore(t) > 10)

    if (candidate) {
      logger.info(`Bot: generating quote for @${candidate.author}`)

      let tone = null
      let text = await generateQuoteComment(candidate, topic.name, style, tone)

      if (text) {
        let result
        do {
          result = await approveAction({ type: 'quote', text, targetTweet: candidate, topic: topic.name, tone })
          if (result.action === 'regenerate') {
            tone = result.tone
            text = await generateQuoteComment(candidate, topic.name, style, tone)
            if (!text) { result = { action: 'skip', text: '' }; break }
          }
        } while (result.action === 'regenerate')

        if (result.action === 'post') {
          try {
            await quoteTweet(result.text, candidate.id, candidate.author)
            markQuoted(candidate.id)
            logger.info(`Bot: quote-tweeted @${candidate.author}`)
            await sleep(settings.delayBetweenActions ?? 5000)
          } catch (err) { logger.error('Bot: quote-tweet failed:', err.message) }
        }
      }
    }
  }

  // 6. Like top tweets (no approval — low-risk)
  if (settings.actions?.like) {
    const toLike = allTweets.slice(0, settings.likesPerCycle ?? 3)
    for (const tweet of toLike) { await likeTweet(tweet.id); await sleep(2000) }
    logger.info(`Bot: liked ${toLike.length} tweets`)
  }

  logger.info(`Bot: cycle complete for "${topic.name}"`)
}

function engagementScore(t) {
  return (t.likes ?? 0) + (t.retweets ?? 0) * 2 + (t.replies ?? 0) * 1.5
}

function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
