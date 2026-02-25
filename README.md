<div align="center">

# ✦ x-EchoMind

**AI-powered X (Twitter) bot with human-in-the-loop approval**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai&logoColor=white)](https://platform.openai.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Author](https://img.shields.io/badge/author-Denys%20Levshenkov-0077B5?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/denys-levshenkov-bb20b7110/)

</div>

---

## What it does

x-EchoMind monitors top tweets on topics you define, analyzes them with AI, and generates contextual content — but **never posts anything without your explicit approval**.

| Feature | Description |
|---|---|
| 🔍 **Analyze** | Fetches top tweets on your topics, extracts themes and sentiment |
| 📝 **Post original tweets** | Generates new tweets based on your defined subjects |
| 💬 **Reply** | Crafts replies to the most engaging tweet per topic |
| 🔁 **Quote-tweet** | Adds commentary to high-engagement posts |
| ❤️ **Like** | Auto-likes top tweets (no approval needed) |
| ✅ **Approval gate** | Every action is shown to you before posting — approve, edit, or skip |
| 🎭 **Tone selector** | Pick a tone per action and regenerate until you're happy — no re-runs needed |

---

## How the approval flow works

Every generated tweet, reply, or quote-tweet is shown to you with a full action menu before anything is posted.

```
──────────────────────────────────────────────────────────────
  📝  NEW TWEET  topic: "AI and machine learning"

  Generated tweet:
  ┌──────────────────────────────────────────────────────────┐
  │ Most AI "breakthroughs" are just scale + better data.   │
  │ The hard problem — reasoning under uncertainty — is      │
  │ still largely unsolved.                                  │
  └──────────────────────────────────────────────────────────┘
  chars: 148/280  [████████░░░░░░░░░░░░░░░░░░░░░░]
──────────────────────────────────────────────────────────────
? What do you want to do?
❯ ✅  Approve — post as-is
  ✏️   Edit — modify before posting
  🎭  Change tone — regenerate with a different style
  ⏭️   Skip — discard this action
```

| Choice | What happens |
|---|---|
| **Approve** | Posts immediately |
| **Edit** | Pre-fills the text for you to modify, then confirms before posting |
| **Change tone** | Opens the tone picker, regenerates with the new style, shows the result again |
| **Skip** | Discards this action, moves to the next one |

### 🎭 Tone selector

When you pick **Change tone**, a second menu appears with 8 tones to choose from. The bot regenerates the content with that tone and shows it again — you can keep switching until you're happy.

```
? 🎭  Pick a tone:
❯ 💡  Serious / Insightful    Write in a serious, thoughtful tone. Be precise…
  🔧  Technical / Precise     Write in a technical, expert tone. Use accurate…
  😄  Humorous / Joke         Write in a witty, funny tone. Be genuinely cleve…
  😏  Sarcastic               Write with dry, sharp sarcasm. Subtle is better…
  🔥  Contrarian / Bold       Take a strong, confident, slightly provocative s…
  💬  Casual / Friendly       Write in a relaxed, conversational tone — like t…
  🎓  Educational             Write in a clear, informative tone as if explain…
  ✨  Inspirational           Write in an uplifting, motivating tone. Make the…
```

The active tone is shown as a colored tag in the header on the next preview:

```
  📝  NEW TWEET  topic: "AI and machine learning"  [😄 humorous]
```

> The `style` field in `topics.json` sets the **default** writing style for a topic. The tone picker **overrides** it for that specific generation only — your config is never changed.

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/x-EchoMind.git
cd x-EchoMind
npm install
```

### 2. Configure environment

Create a `.env` file:

```env
OPENAI_API_KEY=sk-...
```

That's the only key needed. X authentication uses browser cookies — no X API key, no username/password.

### 3. Extract your X session cookies

X has blocked all password-based login flows for bots. The only way to authenticate is with session cookies from your browser:

```bash
npm run setup
```

This walks you through copying two cookies from x.com DevTools and saves them to `data/cookies.json`.

**How to get the cookies:**

1. Open [https://x.com](https://x.com) and log in
2. Press **F12** → **Application** → **Cookies** → **https://x.com**
3. Copy the value of `auth_token`
4. Copy the value of `ct0`
5. Paste each when prompted by `npm run setup`

> Cookies are saved to `data/cookies.json` (gitignored). If they expire, run `npm run setup` again.

### 4. Configure your topics (optional)

Edit [`config/topics.json`](config/topics.json) to define what you want to tweet about:

```json
[
  {
    "name": "AI and machine learning",
    "enabled": true,
    "searchQueries": ["#AI", "#MachineLearning", "artificial intelligence"],
    "subjects": [
      "The biggest misconception people have about AI right now",
      "What most people miss about the current AI revolution"
    ],
    "style": "Thoughtful, slightly contrarian, backed by reasoning.",
    "avoid": ["crypto", "NFT"]
  }
]
```

| Field | Description |
|---|---|
| `name` | Display name for the topic |
| `enabled` | Set to `false` to pause a topic without deleting it |
| `searchQueries` | Array of search terms / hashtags to fetch tweets from |
| `subjects` | Pool of subjects for original tweet generation (one picked randomly per cycle) |
| `style` | Writing style instruction passed to the AI |
| `avoid` | Topics/words the AI should never mention |

### 5. Configure bot behavior

Edit [`config/settings.json`](config/settings.json):

```json
{
  "schedule": "0 */3 * * *",
  "runOnStart": true,
  "tweetsPerSearch": 25,
  "delayBetweenActions": 8000,
  "delayBetweenTopics": 20000,
  "defaultStyle": "Thoughtful, human, slightly opinionated.",
  "actions": {
    "postOriginal": true,
    "reply": true,
    "quoteTweet": true,
    "like": true
  },
  "likesPerCycle": 3
}
```

| Setting | Description |
|---|---|
| `schedule` | Cron expression for how often cycles run ([crontab.guru](https://crontab.guru)) |
| `runOnStart` | Run a cycle immediately on startup |
| `tweetsPerSearch` | How many tweets to fetch per search query |
| `delayBetweenActions` | ms to wait between actions within one cycle (rate limit safety) |
| `actions.*` | Toggle each action type on/off individually |

### 6. Run

```bash
npm start
```

Or with auto-restart on file changes (dev mode):

```bash
npm run dev
```

---

## Project structure

```
x-EchoMind/
├── src/
│   ├── index.js       # Entry point — startup banner, auth, scheduler
│   ├── twitter.js     # Twitter client (search, post, reply, quote, like)
│   ├── ai.js          # OpenAI — analyze tweets, generate content
│   ├── bot.js         # Per-topic cycle logic
│   ├── approver.js    # Interactive terminal approval UI (approve/edit/tone/skip)
│   ├── tones.js       # 8 tone definitions with AI prompt instructions
│   ├── scheduler.js   # Cron-based scheduling
│   ├── state.js       # Persistent state (prevents duplicate actions)
│   └── logger.js      # Winston logger (console + rolling file)
├── config/
│   ├── topics.json    # Your topics, queries, subjects, style
│   └── settings.json  # Schedule, actions, timing
├── data/              # Runtime data (gitignored)
│   ├── cookies.json   # Saved Twitter session
│   ├── state.json     # IDs of tweets already replied/quoted
│   └── echomind.log   # Log file
└── .env               # Your credentials (gitignored)
```

---

## How it works internally

```
[Cron tick]
    │
    ▼
For each topic:
    │
    ├─ searchTweets() ──► fetch top tweets by search query
    │
    ├─ analyzeTweets() ─► AI identifies themes, sentiment,
    │                      and the most engaging tweet
    │
    ├─ generateTweet() ──► AI writes original tweet on a subject
    │       └─ approveAction() ─► YOU decide:
    │               ├─ approve          ──────────────────► postTweet()
    │               ├─ edit             ──► modify text ──► postTweet()
    │               ├─ change tone ──► regenerate ──► show again (loop)
    │               └─ skip             ──► discard
    │
    ├─ generateReply() ──► AI writes reply to the top tweet
    │       └─ approveAction() ─► same loop ──► replyToTweet()
    │
    ├─ generateQuote() ──► AI writes quote-tweet comment
    │       └─ approveAction() ─► same loop ──► quoteTweet()
    │
    └─ likeTweet() ──────► likes top N tweets (auto, no approval)
```

State is persisted to `data/state.json` so already-replied tweet IDs are remembered across restarts.

---

## Tech stack

| Library | Purpose |
|---|---|
| [`agent-twitter-client`](https://www.npmjs.com/package/agent-twitter-client) | Cookie-based Twitter scraper — read & write without API keys |
| [`openai`](https://www.npmjs.com/package/openai) | GPT-4o-mini for analysis and content generation |
| [`@inquirer/prompts`](https://www.npmjs.com/package/@inquirer/prompts) | Interactive terminal prompts for the approval UI |
| [`chalk`](https://www.npmjs.com/package/chalk) | Terminal colors and styling |
| [`node-cron`](https://www.npmjs.com/package/node-cron) | Cron-based scheduling |
| [`winston`](https://www.npmjs.com/package/winston) | Structured logging to console and file |
| [`dotenv`](https://www.npmjs.com/package/dotenv) | `.env` file loading |

---

## Notes

- **Rate limits:** The bot adds deliberate delays between actions (`delayBetweenActions`, `delayBetweenTopics`) to avoid triggering X's rate limiter.
- **Duplicate prevention:** `data/state.json` tracks every tweet ID you've replied to or quoted — you'll never double-engage with the same tweet.
- **Non-interactive mode:** If you run the bot without a TTY (e.g. piped output), all actions are auto-skipped to prevent hanging.
- **Cookies expiry:** If your session cookie expires, the bot will re-login automatically using the credentials in `.env`.

---

## Author

**Denys Levshenkov** — [LinkedIn](https://www.linkedin.com/in/denys-levshenkov-bb20b7110/)
