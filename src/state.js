/**
 * Persistent state to track what we've already acted on.
 * Prevents duplicate replies/quotes across restarts.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_PATH = path.join(__dirname, '../data/state.json')

let state = {
  repliedTo: [],      // tweet IDs we've replied to
  quotedTweets: [],   // tweet IDs we've quote-tweeted
  postedTweets: [],   // our own tweet IDs posted
  recentPosts: [],    // { text, type, ts } — used to feed voice continuity back into generation
  lastMentionId: null,// cursor for inbound mentions polling
  lastRunAt: null,
}

const MAX_HISTORY = 500 // keep last N IDs to avoid unbounded growth
const MAX_RECENT_POSTS = 25 // self-memory window for generators

export function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'))
    } catch {
      // corrupted, start fresh
    }
  }
  return state
}

export function saveState() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  // Trim history
  state.repliedTo = state.repliedTo.slice(-MAX_HISTORY)
  state.quotedTweets = state.quotedTweets.slice(-MAX_HISTORY)
  state.postedTweets = state.postedTweets.slice(-MAX_HISTORY)
  state.recentPosts = (state.recentPosts ?? []).slice(0, MAX_RECENT_POSTS)
  state.lastRunAt = new Date().toISOString()
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

export function hasRepliedTo(tweetId) {
  return state.repliedTo.includes(tweetId)
}

export function hasQuoted(tweetId) {
  return state.quotedTweets.includes(tweetId)
}

export function markReplied(tweetId) {
  state.repliedTo.push(tweetId)
  saveState()
}

export function markQuoted(tweetId) {
  state.quotedTweets.push(tweetId)
  saveState()
}

export function markPosted(tweetId) {
  state.postedTweets.push(tweetId)
  saveState()
}

/**
 * Record a post for self-memory (voice continuity).
 * Replies are intentionally excluded — they're too context-bound to feed back
 * as "your recent voice." Originals and quote-tweets only.
 * @param {{ text: string, type: 'original' | 'quote' }} post
 */
export function recordPost(post) {
  if (!post?.text) return
  if (post.type !== 'original' && post.type !== 'quote') return
  state.recentPosts = state.recentPosts ?? []
  state.recentPosts.unshift({ text: post.text, type: post.type, ts: Date.now() })
  state.recentPosts = state.recentPosts.slice(0, MAX_RECENT_POSTS)
  saveState()
}

/**
 * Return the most recent N self-posts (originals + quotes), newest first.
 * @param {number} limit
 * @returns {{ text: string, type: string, ts: number }[]}
 */
export function getRecentPosts(limit = 15) {
  return (state.recentPosts ?? []).slice(0, limit)
}

/** Get the cursor for inbound-mentions polling. Null on first run. */
export function getLastMentionId() {
  return state.lastMentionId ?? null
}

/** Update the inbound cursor. Pass the highest tweet ID seen in the latest batch. */
export function setLastMentionId(id) {
  if (!id) return
  state.lastMentionId = String(id)
  saveState()
}
