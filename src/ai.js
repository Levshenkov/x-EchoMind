/**
 * AI module — analysis and generation via OpenAI gpt-4o-mini.
 */
import OpenAI from 'openai'
import { toneInstruction } from './tones.js'
import logger from './logger.js'

let client = null

function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY in .env')
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

const MODEL = 'gpt-4o-mini'

/**
 * Analyze a batch of tweets and return structured insights.
 * @param {object[]} tweets - Normalized tweet objects
 * @param {string} topic    - The topic/subject context
 * @returns {{ summary, topEngagementTweet, themes, sentiment }}
 */
export async function analyzeTweets(tweets, topic) {
  if (!tweets.length) return { summary: 'No tweets found', topEngagementTweet: null, themes: [], sentiment: 'neutral' }

  const tweetList = tweets
    .slice(0, 15)
    .map((t, i) => `[${i + 1}] @${t.author} (${t.likes}❤️ ${t.retweets}🔁): "${t.text}"`)
    .join('\n')

  const prompt = `You are analyzing tweets about the topic: "${topic}".

Here are the top tweets:
${tweetList}

Respond with valid JSON in this exact shape:
{
  "summary": "<2-3 sentence summary of what people are saying>",
  "themes": ["<theme1>", "<theme2>", "<theme3>"],
  "sentiment": "positive|negative|mixed|neutral",
  "bestTweetIndex": <1-based index of the tweet most worth engaging with, or null>,
  "engagementReason": "<why this tweet is worth engaging with>"
}`

  try {
    const res = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const parsed = JSON.parse(res.choices[0].message.content)
    const idx = parsed.bestTweetIndex ? parsed.bestTweetIndex - 1 : null
    return {
      summary: parsed.summary,
      themes: parsed.themes ?? [],
      sentiment: parsed.sentiment ?? 'neutral',
      topEngagementTweet: idx !== null ? tweets[idx] : null,
      engagementReason: parsed.engagementReason ?? '',
    }
  } catch (err) {
    logger.error('AI: analyzeTweets failed:', err.message)
    return { summary: 'Analysis failed', topEngagementTweet: null, themes: [], sentiment: 'neutral' }
  }
}

/**
 * Generate an original tweet on a subject.
 * @param {string}   subject  - The topic/subject to tweet about
 * @param {string[]} themes   - Current trending themes (from recent analysis)
 * @param {string}   style    - Base writing style from config
 * @param {string[]} avoid    - Topics/phrases to avoid
 * @param {string}   [tone]   - Tone override (from tones.js) — takes priority over style
 */
export async function generateTweet(subject, themes = [], style = '', avoid = [], tone = null) {
  const themeContext = themes.length ? `\nTrending themes right now: ${themes.join(', ')}` : ''
  const avoidNote   = avoid.length  ? `\nDo NOT mention or reference: ${avoid.join(', ')}` : ''
  const styleNote   = !tone && style ? `\nWriting style: ${style}` : ''
  const toneNote    = toneInstruction(tone)

  const prompt = `Write a single original tweet about: "${subject}"${themeContext}${styleNote}${toneNote}${avoidNote}

Rules:
- Max 280 characters
- No hashtags unless they add real value (max 2)
- No emojis unless they genuinely enhance the message
- Sound like a real, thoughtful person — not a bot
- Be insightful, opinionated, or surprising — not generic
- Return ONLY the tweet text, nothing else`

  try {
    const res = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
    })
    const text = res.choices[0].message.content.trim().replace(/^["']|["']$/g, '')
    logger.info(`AI: generated tweet (${text.length} chars)${tone ? ` [tone: ${tone}]` : ''}`)
    return text
  } catch (err) {
    logger.error('AI: generateTweet failed:', err.message)
    return null
  }
}

/**
 * Generate a reply to a tweet.
 * @param {object} tweet  - The tweet to reply to
 * @param {string} topic  - Context topic
 * @param {string} style  - Base writing style
 * @param {string} [tone] - Tone override
 */
export async function generateReply(tweet, topic, style = '', tone = null) {
  const styleNote = !tone && style ? `\nWriting style: ${style}` : ''
  const toneNote  = toneInstruction(tone)

  const prompt = `You are replying to this tweet by @${tweet.author}:
"${tweet.text}"

Topic context: ${topic}${styleNote}${toneNote}

Write a reply that:
- Directly engages with what they said
- Adds value, insight, or a thoughtful counterpoint
- Max 280 characters
- No hashtags
- Return ONLY the reply text`

  try {
    const res = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
    })
    const text = res.choices[0].message.content.trim().replace(/^["']|["']$/g, '')
    logger.info(`AI: generated reply (${text.length} chars)${tone ? ` [tone: ${tone}]` : ''}`)
    return text
  } catch (err) {
    logger.error('AI: generateReply failed:', err.message)
    return null
  }
}

/**
 * Generate a quote-tweet comment.
 * @param {object} tweet  - The tweet to quote
 * @param {string} topic  - Context topic
 * @param {string} style  - Base writing style
 * @param {string} [tone] - Tone override
 */
export async function generateQuoteComment(tweet, topic, style = '', tone = null) {
  const styleNote = !tone && style ? `\nWriting style: ${style}` : ''
  const toneNote  = toneInstruction(tone)

  const prompt = `You are quote-tweeting this post by @${tweet.author}:
"${tweet.text}"

Topic context: ${topic}${styleNote}${toneNote}

Write a quote-tweet comment that:
- Adds your perspective or expands on their point
- Stands on its own even without reading the original
- Max 240 characters (leave room for the quoted tweet)
- Return ONLY the comment text`

  try {
    const res = await getClient().chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
    })
    const text = res.choices[0].message.content.trim().replace(/^["']|["']$/g, '')
    logger.info(`AI: generated quote comment (${text.length} chars)${tone ? ` [tone: ${tone}]` : ''}`)
    return text
  } catch (err) {
    logger.error('AI: generateQuoteComment failed:', err.message)
    return null
  }
}
