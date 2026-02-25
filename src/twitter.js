/**
 * X (Twitter) client — direct GraphQL API with web bearer token.
 * Auth is cookie-only (auth_token + ct0).
 * Run "npm run setup" to extract cookies from your browser.
 *
 * If API calls start returning 404, the query IDs may have rotated.
 * Update the QID constants below from X's JS bundle:
 *   https://abs.twimg.com/responsive-web/client-web/main.*.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COOKIES_PATH = path.join(__dirname, '../data/cookies.json')

// Web bearer token (paired with browser session cookies — do NOT use mobile bearer)
const WEB_BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

// X GraphQL query IDs — rotate every few weeks, update if endpoints return 404
const QID = {
  UserByScreenName: 'DYkHHnsQHOuIl0gUzU5Fjg',
  UserTweets: 'rO1eqEVXEJOZkbKmVFg5IQ',
  HomeTimeline: 'MpnCeE0hy8m5eWobPx8euw',
  CreateTweet: 'Ke9I4_p5rCzwhTzK1fV2_w',
  FavoriteTweet: 'lI07N6Otwv1PhnEgXILM7A',
  CreateRetweet: 'mbRO74GrOvSfRcJnlMapnQ',
}

// Feature flags required by the UserTweets / HomeTimeline endpoints
const TIMELINE_FEATURES = {
  rweb_lists_timeline_redesign_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: false,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
}

// Feature flags required by CreateTweet
const TWEET_FEATURES = {
  interactive_text_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_text_conversations_enabled: false,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
  vibe_api_enabled: false,
  rweb_lists_timeline_redesign_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  longform_notetweets_rich_text_read_enabled: true,
  responsive_web_enhance_cards_enabled: false,
}

let authToken = null
let ct0 = null

function buildHeaders() {
  return {
    authorization: `Bearer ${WEB_BEARER}`,
    cookie: `auth_token=${authToken}; ct0=${ct0}`,
    'x-csrf-token': ct0,
    'content-type': 'application/json',
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    referer: 'https://x.com/',
    origin: 'https://x.com',
  }
}

async function xFetch(url, options = {}) {
  const res = await fetch(url, { headers: buildHeaders(), ...options })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`X API ${res.status} ${res.statusText}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for tweets by keyword, hashtag, or cashtag (e.g. $BTC, #AI, "OpenAI").
 * Uses X's legacy adaptive.json REST endpoint — no GraphQL query ID needed.
 * @param {string} query
 * @param {number} count
 * @returns {Promise<Tweet[]>}
 */
export async function searchTweets(query, count = 20) {
  try {
    const params = new URLSearchParams({
      q: query,
      count: String(Math.min(count, 100)),
      tweet_mode: 'extended',
      query_source: 'typed_query',
      include_quote_count: 'true',
      include_reply_count: '1',
      include_ext_views: 'true',
    })

    const data = await xFetch(`https://twitter.com/i/api/2/search/adaptive.json?${params}`)
    const tweets = parseAdaptiveSearch(data, count)
    logger.info(`Twitter: search "${query}" → ${tweets.length} tweets`)
    return tweets
  } catch (err) {
    logger.error(`Twitter: searchTweets failed for "${query}":`, err.message)
    return []
  }
}

export async function initTwitter() {
  if (!fs.existsSync(COOKIES_PATH)) {
    throw new Error('No cookies found. Run: npm run setup')
  }

  const raw = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'))
  const cookieMap = Object.fromEntries(raw.map(c => [c.name, c.value]))

  authToken = cookieMap['auth_token']
  ct0 = cookieMap['ct0']

  if (!authToken || !ct0) {
    throw new Error('Missing auth_token or ct0 in cookies.json. Run: npm run setup')
  }

  logger.info('Twitter: cookies loaded')
}

/**
 * Resolve a screen name to a numeric user ID.
 * @param {string} screenName
 * @returns {Promise<string|null>}
 */
export async function getUserId(screenName) {
  const variables = { screen_name: screenName, withSafetyModeUserFields: true }
  const features = {
    hidden_profile_likes_enabled: false,
    hidden_profile_subscriptions_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
  }

  const url =
    `https://x.com/i/api/graphql/${QID.UserByScreenName}/UserByScreenName` +
    `?variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&features=${encodeURIComponent(JSON.stringify(features))}`

  try {
    const data = await xFetch(url)
    return data?.data?.user?.result?.rest_id ?? null
  } catch (err) {
    logger.error(`Twitter: getUserId failed for @${screenName}:`, err.message)
    return null
  }
}

/**
 * Fetch recent tweets from a specific account's timeline.
 * @param {string} username  - X screen name without @
 * @param {number} count
 * @returns {Promise<Tweet[]>}
 */
export async function getAccountTweets(username, count = 20) {
  try {
    const userId = await getUserId(username)
    if (!userId) {
      logger.warn(`Twitter: could not resolve user ID for @${username}`)
      return []
    }

    const variables = {
      userId,
      count,
      includePromotedContent: true,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
      withV2Timeline: true,
    }

    const url =
      `https://x.com/i/api/graphql/${QID.UserTweets}/UserTweets` +
      `?variables=${encodeURIComponent(JSON.stringify(variables))}` +
      `&features=${encodeURIComponent(JSON.stringify(TIMELINE_FEATURES))}`

    const data = await xFetch(url)
    const instructions =
      data?.data?.user?.result?.timeline_v2?.timeline?.instructions ?? []
    const tweets = extractTweets(instructions, username)

    logger.info(`Twitter: fetched ${tweets.length} tweets from @${username}`)
    return tweets
  } catch (err) {
    logger.error(`Twitter: getAccountTweets failed for @${username}:`, err.message)
    return []
  }
}

/**
 * Get the home timeline (tweets from followed accounts).
 * @param {number} count
 * @returns {Promise<Tweet[]>}
 */
export async function getTimeline(count = 20) {
  try {
    const variables = { count, includePromotedContent: true, latestControlAvailable: true }

    const url =
      `https://x.com/i/api/graphql/${QID.HomeTimeline}/HomeTimeline` +
      `?variables=${encodeURIComponent(JSON.stringify(variables))}` +
      `&features=${encodeURIComponent(JSON.stringify(TIMELINE_FEATURES))}`

    const data = await xFetch(url)
    const instructions = data?.data?.home?.home_timeline_urt?.instructions ?? []
    return extractTweets(instructions)
  } catch (err) {
    logger.error('Twitter: getTimeline failed:', err.message)
    return []
  }
}

/**
 * Post a new tweet.
 * @param {string} text
 * @returns {Promise<Tweet|null>}
 */
export async function postTweet(text) {
  const body = {
    variables: {
      tweet_text: text,
      dark_request: false,
      media: { media_entities: [], possibly_sensitive: false },
      semantic_annotation_ids: [],
    },
    features: TWEET_FEATURES,
    queryId: QID.CreateTweet,
  }

  const data = await xFetch(`https://x.com/i/api/graphql/${QID.CreateTweet}/CreateTweet`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  logger.info(`Twitter: posted tweet (${text.length} chars)`)
  const result = data?.data?.create_tweet?.tweet_results?.result
  return result ? parseTweetResult(result) : null
}

/**
 * Reply to a tweet.
 * @param {string} text
 * @param {string} tweetId
 * @returns {Promise<Tweet|null>}
 */
export async function replyToTweet(text, tweetId) {
  const body = {
    variables: {
      tweet_text: text,
      reply: { in_reply_to_tweet_id: tweetId, exclude_reply_user_ids: [] },
      dark_request: false,
      media: { media_entities: [], possibly_sensitive: false },
      semantic_annotation_ids: [],
    },
    features: TWEET_FEATURES,
    queryId: QID.CreateTweet,
  }

  const data = await xFetch(`https://x.com/i/api/graphql/${QID.CreateTweet}/CreateTweet`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  logger.info(`Twitter: replied to tweet ${tweetId}`)
  const result = data?.data?.create_tweet?.tweet_results?.result
  return result ? parseTweetResult(result) : null
}

/**
 * Quote-tweet (retweet with comment).
 * @param {string} text
 * @param {string} tweetId
 * @param {string} [authorUsername]  - needed for the attachment URL
 * @returns {Promise<Tweet|null>}
 */
export async function quoteTweet(text, tweetId, authorUsername) {
  const attachmentUrl = `https://x.com/${authorUsername ?? 'x'}/status/${tweetId}`
  const body = {
    variables: {
      tweet_text: text,
      attachment_url: attachmentUrl,
      dark_request: false,
      media: { media_entities: [], possibly_sensitive: false },
      semantic_annotation_ids: [],
    },
    features: TWEET_FEATURES,
    queryId: QID.CreateTweet,
  }

  const data = await xFetch(`https://x.com/i/api/graphql/${QID.CreateTweet}/CreateTweet`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  logger.info(`Twitter: quote-tweeted ${tweetId}`)
  const result = data?.data?.create_tweet?.tweet_results?.result
  return result ? parseTweetResult(result) : null
}

/**
 * Like a tweet.
 * @param {string} tweetId
 */
export async function likeTweet(tweetId) {
  const body = {
    variables: { tweet_id: tweetId },
    queryId: QID.FavoriteTweet,
  }

  await xFetch(`https://x.com/i/api/graphql/${QID.FavoriteTweet}/FavoriteTweet`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  logger.info(`Twitter: liked tweet ${tweetId}`)
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/**
 * Parse adaptive.json response (legacy REST search format).
 * globalObjects.tweets is a flat map of id → tweet, globalObjects.users is id → user.
 */
function parseAdaptiveSearch(data, limit) {
  const tweetMap = data?.globalObjects?.tweets ?? {}
  const userMap = data?.globalObjects?.users ?? {}

  return Object.entries(tweetMap)
    .map(([id, t]) => {
      const user = userMap[t.user_id_str] ?? {}
      return {
        id: t.id_str ?? id,
        text: t.full_text ?? t.text ?? '',
        author: user.screen_name ?? 'unknown',
        authorName: user.name ?? '',
        likes: t.favorite_count ?? 0,
        retweets: t.retweet_count ?? 0,
        replies: t.reply_count ?? 0,
        views: parseInt(t.ext?.views?.count ?? '0', 10),
        createdAt: t.created_at ? new Date(t.created_at) : null,
        url: `https://x.com/${user.screen_name}/status/${t.id_str ?? id}`,
        isReply: !!t.in_reply_to_status_id_str,
        isRetweet: !!t.retweeted_status_id_str,
        hashtags: t.entities?.hashtags?.map(h => h.text) ?? [],
        mentions: t.entities?.user_mentions?.map(m => m.screen_name) ?? [],
      }
    })
    .filter(t => !t.isRetweet)
    .slice(0, limit)
}

function extractTweets(instructions, fallbackUsername) {
  const tweets = []
  for (const instruction of instructions) {
    if (instruction.type !== 'TimelineAddEntries') continue
    for (const entry of instruction.entries ?? []) {
      // Single tweet entry
      const single = entry.content?.itemContent
      if (single?.itemType === 'TimelineTweet') {
        const t = parseTweetResult(single.tweet_results?.result, fallbackUsername)
        if (t) tweets.push(t)
        continue
      }
      // Module entries (threads / conversations)
      for (const item of entry.content?.items ?? []) {
        const ic = item.item?.itemContent
        if (ic?.itemType === 'TimelineTweet') {
          const t = parseTweetResult(ic.tweet_results?.result, fallbackUsername)
          if (t) tweets.push(t)
        }
      }
    }
  }
  return tweets
}

function parseTweetResult(result, fallbackUsername) {
  if (!result) return null
  if (result.__typename === 'TweetTombstone') return null

  // Some entries wrap the tweet one level deeper
  const tweetData = result.tweet ?? result
  const legacy = tweetData.legacy
  if (!legacy) return null

  const userLegacy = tweetData.core?.user_results?.result?.legacy ?? {}
  const author = userLegacy.screen_name ?? fallbackUsername ?? 'unknown'

  return {
    id: tweetData.rest_id,
    text: legacy.full_text,
    author,
    authorName: userLegacy.name ?? '',
    likes: legacy.favorite_count ?? 0,
    retweets: legacy.retweet_count ?? 0,
    replies: legacy.reply_count ?? 0,
    views: parseInt(tweetData.views?.count ?? '0', 10),
    createdAt: legacy.created_at ? new Date(legacy.created_at) : null,
    url: `https://x.com/${author}/status/${tweetData.rest_id}`,
    isReply: !!legacy.in_reply_to_status_id_str,
    isRetweet: !!legacy.retweeted_status_id_str,
    hashtags: legacy.entities?.hashtags?.map(h => h.text) ?? [],
    mentions: legacy.entities?.user_mentions?.map(m => m.screen_name) ?? [],
  }
}
