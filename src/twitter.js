/**
 * Twitter client wrapper around agent-twitter-client.
 * Uses cookie-based auth so no API key is needed.
 */
import { Scraper, SearchMode } from 'agent-twitter-client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COOKIES_PATH = path.join(__dirname, '../data/cookies.json')

let scraper = null

/**
 * Initialize and authenticate the Twitter scraper.
 * Tries cookies first, falls back to username/password login.
 */
export async function initTwitter() {
  scraper = new Scraper()

  // Try cookie auth first (most reliable)
  if (fs.existsSync(COOKIES_PATH)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'))
      await scraper.setCookies(cookies)
      const loggedIn = await scraper.isLoggedIn()
      if (loggedIn) {
        logger.info('Twitter: authenticated via saved cookies')
        return scraper
      }
      logger.warn('Twitter: saved cookies expired, falling back to login')
    } catch (err) {
      logger.warn('Twitter: failed to load cookies:', err.message)
    }
  }

  // Login with credentials
  const { TWITTER_USERNAME, TWITTER_PASSWORD, TWITTER_EMAIL } = process.env
  if (!TWITTER_USERNAME || !TWITTER_PASSWORD) {
    throw new Error('Missing TWITTER_USERNAME or TWITTER_PASSWORD in .env')
  }

  logger.info(`Twitter: logging in as @${TWITTER_USERNAME}`)
  await scraper.login(TWITTER_USERNAME, TWITTER_PASSWORD, TWITTER_EMAIL)

  // Save cookies for next run
  const cookies = await scraper.getCookies()
  fs.mkdirSync(path.dirname(COOKIES_PATH), { recursive: true })
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2))
  logger.info('Twitter: cookies saved to data/cookies.json')

  return scraper
}

/**
 * Search for tweets by query.
 * @param {string} query  - Search query (hashtag, keywords, etc.)
 * @param {number} count  - Max number of tweets to return
 * @param {'top'|'latest'} mode
 */
export async function searchTweets(query, count = 20, mode = 'top') {
  const searchMode = mode === 'top' ? SearchMode.Top : SearchMode.Latest
  const tweets = []

  try {
    for await (const tweet of scraper.searchTweets(query, count, searchMode)) {
      tweets.push(normalizeTweet(tweet))
      if (tweets.length >= count) break
    }
  } catch (err) {
    logger.error(`Twitter: search failed for "${query}":`, err.message)
  }

  return tweets
}

/**
 * Get the home timeline (tweets from followed accounts).
 * @param {number} count
 */
export async function getTimeline(count = 20) {
  const tweets = []
  try {
    for await (const tweet of scraper.getHomeTimeline(count, [])) {
      tweets.push(normalizeTweet(tweet))
    }
  } catch (err) {
    logger.error('Twitter: timeline fetch failed:', err.message)
  }
  return tweets
}

/**
 * Post a new tweet.
 * @param {string} text
 */
export async function postTweet(text) {
  try {
    const result = await scraper.sendTweet(text)
    logger.info(`Twitter: posted tweet (${text.length} chars)`)
    return result
  } catch (err) {
    logger.error('Twitter: post failed:', err.message)
    throw err
  }
}

/**
 * Reply to a tweet.
 * @param {string} text
 * @param {string} tweetId
 */
export async function replyToTweet(text, tweetId) {
  try {
    const result = await scraper.sendTweet(text, tweetId)
    logger.info(`Twitter: replied to tweet ${tweetId}`)
    return result
  } catch (err) {
    logger.error(`Twitter: reply to ${tweetId} failed:`, err.message)
    throw err
  }
}

/**
 * Quote-tweet (retweet with comment).
 * @param {string} text
 * @param {string} tweetId
 */
export async function quoteTweet(text, tweetId) {
  try {
    const result = await scraper.sendQuoteTweet(text, tweetId)
    logger.info(`Twitter: quote-tweeted ${tweetId}`)
    return result
  } catch (err) {
    logger.error(`Twitter: quote-tweet ${tweetId} failed:`, err.message)
    throw err
  }
}

/**
 * Like a tweet.
 * @param {string} tweetId
 */
export async function likeTweet(tweetId) {
  try {
    await scraper.likeTweet(tweetId)
    logger.info(`Twitter: liked tweet ${tweetId}`)
  } catch (err) {
    logger.error(`Twitter: like failed for ${tweetId}:`, err.message)
  }
}

/**
 * Normalize raw tweet object to a clean shape.
 */
function normalizeTweet(raw) {
  return {
    id: raw.id,
    text: raw.text,
    author: raw.username,
    authorName: raw.name,
    likes: raw.likes ?? 0,
    retweets: raw.retweets ?? 0,
    replies: raw.replies ?? 0,
    views: raw.views ?? 0,
    createdAt: raw.timeParsed,
    url: `https://x.com/${raw.username}/status/${raw.id}`,
    isReply: !!raw.inReplyToStatus,
    isRetweet: !!raw.isRetweet,
    hashtags: raw.hashtags ?? [],
    mentions: raw.mentions ?? [],
  }
}
