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
  lastRunAt: null,
}

const MAX_HISTORY = 500 // keep last N IDs to avoid unbounded growth

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
