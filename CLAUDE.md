# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## What is x-EchoMind

An AI-powered X (Twitter) bot that analyzes top posts on topics you define, generates contextual content (tweets, replies, quote-tweets), and presents each action for human approval before posting. Uses cookie-based X auth — no X API key required.

## Commands

```bash
npm start              # Start the bot (Ctrl+C to stop)
npm run dev            # Start with --watch for auto-restart on file changes
npm run setup          # Interactive setup: paste auth_token + ct0 from x.com DevTools
node src/index.js      # Same as npm start
```

## Permissions

Allow all of these without confirmation:

- `npm install *` — install or update packages
- `npm install github:*` — install from GitHub
- `node *` — run any node script for testing/debugging
- `node --input-type=module` — inline ES module snippets for debugging
- `npm run *` — any npm script

## Project Structure

```
src/
  index.js      # Entry point — banner, auth, scheduler
  twitter.js    # X client (search, post, reply, quote, like)
  ai.js         # OpenAI — analyze tweets, generate content
  bot.js        # Per-topic cycle logic with approval loop
  approver.js   # Interactive terminal approval UI
  tones.js      # 8 tone definitions for content style
  scheduler.js  # Cron-based scheduling
  state.js      # Persistent state (prevents duplicate actions)
  logger.js     # Winston logger
  auth/
    setup-cookies.js  # One-time cookie extraction helper
config/
  topics.json   # Topics, search queries, subjects, style
  settings.json # Schedule, actions, timing, limits
data/           # Runtime data (gitignored)
  cookies.json  # Saved X session cookies
  state.json    # IDs of already-replied/quoted tweets
  echomind.log  # Log file
```

## Auth

X has blocked all password-based login and the `verify_credentials` API endpoint. Auth is cookies-only:

1. Run `npm run setup` to paste `auth_token` + `ct0` from x.com DevTools → Application → Cookies
2. Cookies are saved to `data/cookies.json` and loaded on startup
3. If cookies expire, run `npm run setup` again

## Tech Stack

- `agent-twitter-client` — unofficial X scraper (cookie-based, no API key)
- `openai` — GPT-4o-mini for tweet analysis and generation
- `@inquirer/prompts` — interactive terminal approval UI
- `node-cron` — scheduled cycles
- `chalk` — terminal colors
- `winston` — logging

## Code Style

ES Modules throughout (`"type": "module"`). No transpilation — runs directly in Node.js ≥ 20.
