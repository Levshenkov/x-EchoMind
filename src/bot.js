/**
 * Core bot logic — orchestrates the topic cycle.
 * Every generated action goes through approveAction().
 * If the user picks "Change tone", we regenerate and show again.
 */
import { searchTweets, getAccountTweets, getMentions, postTweet, replyToTweet, quoteTweet, likeTweet } from './twitter.js'
import { analyzeTweets, generateTweet, generateReply, generateQuoteComment } from './ai.js'
import { approveAction } from './approver.js'
import {
  hasRepliedTo, hasQuoted,
  markReplied, markQuoted, markPosted,
  recordPost, getRecentPosts,
  getLastMentionId, setLastMentionId,
} from './state.js'
import logger from './logger.js'

export async function runTopicCycle(topic, settings) {
  logger.info(`Bot: starting cycle for topic "${topic.name}"`)

  // 1. Fetch top tweets — prefer searchQueries (keyword search), fall back to accounts
  let allTweets = []

  if (topic.searchQueries?.length) {
    for (const query of topic.searchQueries) {
      const tweets = await searchTweets(query, settings.tweetsPerSearch ?? 20)
      allTweets.push(...tweets)
    }
  } else {
    for (const account of topic.accounts ?? []) {
      const tweets = await getAccountTweets(account, settings.tweetsPerSearch ?? 20)
      allTweets.push(...tweets)
    }
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
    let recent = getRecentPosts(15)
    let text = await generateTweet(subject, analysis.themes, style, topic.avoid, tone, recent)

    if (text) {
      let result
      do {
        result = await approveAction({ type: 'tweet', text, topic: topic.name, tone })
        if (result.action === 'regenerate') {
          tone = result.tone
          text = await generateTweet(subject, analysis.themes, style, topic.avoid, tone, recent)
          if (!text) { result = { action: 'skip', text: '' }; break }
        }
      } while (result.action === 'regenerate')

      if (result.action === 'post') {
        try {
          const res = await postTweet(result.text)
          if (res?.id) markPosted(res.id)
          recordPost({ text: result.text, type: 'original' })
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
      let recent = getRecentPosts(15)
      let text = await generateReply(target, topic.name, style, tone, recent)

      if (text) {
        let result
        do {
          result = await approveAction({ type: 'reply', text, targetTweet: target, topic: topic.name, tone })
          if (result.action === 'regenerate') {
            tone = result.tone
            text = await generateReply(target, topic.name, style, tone, recent)
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
      let recent = getRecentPosts(15)
      let text = await generateQuoteComment(candidate, topic.name, style, tone, recent)

      if (text) {
        let result
        do {
          result = await approveAction({ type: 'quote', text, targetTweet: candidate, topic: topic.name, tone })
          if (result.action === 'regenerate') {
            tone = result.tone
            text = await generateQuoteComment(candidate, topic.name, style, tone, recent)
            if (!text) { result = { action: 'skip', text: '' }; break }
          }
        } while (result.action === 'regenerate')

        if (result.action === 'post') {
          try {
            await quoteTweet(result.text, candidate.id, candidate.author)
            markQuoted(candidate.id)
            recordPost({ text: result.text, type: 'quote' })
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

/**
 * Run one interactive cycle for a user-supplied search query.
 * Searches for top tweets, generates a reply to the most popular one,
 * and generates an original tweet — both go through the approval loop.
 */
export async function runSearchCycle(query, settings) {
  const topic = {
    name: query,
    searchQueries: [query],
    subjects: [
      `My perspective on ${query}`,
      `What everyone is missing about ${query}`,
      `The real story behind ${query}`,
    ],
    style: settings.defaultStyle ?? 'Thoughtful, human, slightly opinionated. No buzzwords.',
    avoid: [],
  }
  return runTopicCycle(topic, settings)
}

/**
 * Inbound cycle — fetch mentions newer than the saved cursor,
 * generate a reply for each, run through the same approval gate.
 *
 * @param {object} args
 * @param {string} args.handle   - Bot's X handle (no @)
 * @param {object} args.settings - Bot settings (uses delayBetweenActions, defaultStyle)
 */
export async function runInboundCycle({ handle, settings }) {
  if (!handle) { logger.error('Inbound: missing handle'); return }

  logger.info(`Inbound: checking mentions for @${handle}`)
  const sinceId = getLastMentionId()
  const mentions = await getMentions(handle, sinceId, settings.mentionsPerCycle ?? 30)

  if (!mentions.length) {
    logger.info('Inbound: no new mentions')
    return
  }
  logger.info(`Inbound: ${mentions.length} new mention(s)`)

  // Advance the cursor up front to the newest ID we saw. Even if the user
  // skips every reply, we still don't want to re-surface the same batch.
  setLastMentionId(mentions[0].id)

  const candidates = mentions.filter(t => !hasRepliedTo(t.id))
  if (!candidates.length) {
    logger.info('Inbound: all new mentions already handled')
    return
  }

  const style = settings.defaultStyle ?? ''
  const topicHint = 'Replying to a mention or reply on X'

  for (const target of candidates) {
    logger.info(`Inbound: generating reply to @${target.author} (${target.id})`)

    let tone = null
    let recent = getRecentPosts(15)
    let text = await generateReply(target, topicHint, style, tone, recent)
    if (!text) continue

    let result
    do {
      result = await approveAction({ type: 'reply', text, targetTweet: target, topic: topicHint, tone })
      if (result.action === 'regenerate') {
        tone = result.tone
        text = await generateReply(target, topicHint, style, tone, recent)
        if (!text) { result = { action: 'skip', text: '' }; break }
      }
    } while (result.action === 'regenerate')

    if (result.action === 'post') {
      try {
        await replyToTweet(result.text, target.id)
        markReplied(target.id)
        logger.info(`Inbound: replied to @${target.author}`)
        await sleep(settings.delayBetweenActions ?? 5000)
      } catch (err) {
        logger.error('Inbound: reply failed:', err.message)
      }
    }
  }

  logger.info('Inbound: cycle complete')
}

function engagementScore(t) {
  return (t.likes ?? 0) + (t.retweets ?? 0) * 2 + (t.replies ?? 0) * 1.5
}

function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
