/**
 * Human-in-the-loop approval for all bot actions.
 * Options: Approve | Edit | Change tone (regenerate) | Skip
 */
import { select, input, confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import { TONES, getTone } from './tones.js'
import logger from './logger.js'

// ── Color palette ────────────────────────────────────────────────
const c = {
  tweet:   chalk.bold.cyan,
  reply:   chalk.bold.green,
  quote:   chalk.bold.magenta,
  dim:     chalk.dim,
  border:  chalk.dim,
  text:    chalk.white,
  muted:   chalk.gray,
  success: chalk.bold.greenBright,
  skip:    chalk.dim.yellow,
  regen:   chalk.bold.yellow,
  label:   chalk.bold.white,
  tone:    chalk.bold.magentaBright,
  count: {
    ok:   chalk.green,
    warn: chalk.yellow,
    over: chalk.red,
  },
}

const TYPE_CONFIG = {
  tweet: { icon: '📝', label: 'NEW TWEET',   color: c.tweet },
  reply: { icon: '💬', label: 'REPLY',        color: c.reply },
  quote: { icon: '🔁', label: 'QUOTE TWEET', color: c.quote },
}

/**
 * Prompt the user to approve, edit, change tone, or skip a generated action.
 *
 * @param {object} opts
 * @param {'tweet'|'reply'|'quote'} opts.type
 * @param {string}  opts.text          - Generated text to review
 * @param {object}  [opts.targetTweet] - For reply/quote: the original tweet
 * @param {string}  opts.topic         - Topic name for context
 * @param {string}  [opts.tone]        - Currently applied tone (if any)
 *
 * @returns {{ action: 'post'|'skip'|'regenerate', text: string, tone?: string }}
 */
export async function approveAction({ type, text, targetTweet, topic, tone = null }) {
  // Non-interactive mode — auto-skip to avoid hanging
  if (!process.stdin.isTTY) {
    logger.warn('Approver: non-interactive mode — skipping action (no TTY)')
    return { action: 'skip', text }
  }

  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.tweet

  printDivider()
  printHeader(cfg, targetTweet, topic, tone)

  if (targetTweet) {
    console.log()
    console.log(c.muted(`  Original tweet by @${targetTweet.author}:`))
    console.log(c.dim(`  "${targetTweet.text}"`))
    console.log(c.muted(`  ${targetTweet.likes}❤️  ${targetTweet.retweets}🔁  ${targetTweet.replies ?? 0}💬`))
  }

  console.log()
  console.log(c.label(`  Generated ${type}:`))
  printContentBox(text, cfg.color)
  printCharCount(text.length)
  printDivider()

  const choice = await select({
    message: chalk.bold('What do you want to do?'),
    choices: [
      { name: chalk.greenBright('✅  Approve')      + chalk.dim(' — post as-is'),                        value: 'approve' },
      { name: chalk.yellow('✏️   Edit')              + chalk.dim(' — modify before posting'),              value: 'edit'    },
      { name: chalk.magentaBright('🎭  Change tone') + chalk.dim(' — regenerate with a different style'), value: 'tone'    },
      { name: chalk.dim('⏭️   Skip')                + chalk.dim(' — discard this action'),                value: 'skip'    },
    ],
  })

  // ── Skip ──────────────────────────────────────────────────────
  if (choice === 'skip') {
    console.log(c.skip('  ⏭  Skipped.\n'))
    return { action: 'skip', text }
  }

  // ── Edit ──────────────────────────────────────────────────────
  if (choice === 'edit') {
    const edited = await input({
      message: chalk.yellow('Edit the text') + chalk.dim(' (max 280 chars):'),
      default: text,
      validate: val => {
        if (!val.trim()) return 'Text cannot be empty'
        if (val.length > 280) return chalk.red(`Too long: ${val.length}/280 chars`)
        return true
      },
    })

    console.log()
    console.log(c.label('  Final text:'))
    printContentBox(edited, cfg.color)
    printCharCount(edited.length)

    const ok = await confirm({ message: chalk.bold('Post this?'), default: true })
    if (!ok) {
      console.log(c.skip('  ⏭  Skipped.\n'))
      return { action: 'skip', text: edited }
    }

    console.log(c.success('  ✅  Approved (edited).\n'))
    return { action: 'post', text: edited }
  }

  // ── Change tone ───────────────────────────────────────────────
  if (choice === 'tone') {
    const selectedTone = await select({
      message: chalk.magentaBright('🎭  Pick a tone:'),
      choices: TONES.map(t => ({
        name: `${t.icon}  ${chalk.bold(t.label)}  ${chalk.dim(t.instruction.slice(0, 55) + '…')}`,
        value: t.value,
        disabled: t.value === tone ? chalk.dim('← current') : false,
      })),
    })

    const picked = getTone(selectedTone)
    console.log(c.regen(`\n  🔄  Regenerating as ${picked.icon} ${picked.label}…\n`))
    return { action: 'regenerate', text, tone: selectedTone }
  }

  // ── Approve ───────────────────────────────────────────────────
  console.log(c.success('  ✅  Approved.\n'))
  return { action: 'post', text }
}

// ── Helpers ──────────────────────────────────────────────────────

function printDivider() {
  console.log(c.border('─'.repeat(62)))
}

function printHeader(cfg, targetTweet, topic, tone) {
  const topicTag  = chalk.dim(`topic: "${topic}"`)
  const authorTag = targetTweet ? chalk.dim(` → @${targetTweet.author}`) : ''
  const toneTag   = tone ? '  ' + c.tone(`[${getTone(tone)?.icon ?? ''} ${tone}]`) : ''
  console.log(`\n  ${cfg.icon}  ${cfg.color(cfg.label)}${authorTag}  ${topicTag}${toneTag}`)
}

function printContentBox(text, colorFn) {
  const WIDTH = 56
  const lines = []

  const words = text.split(' ')
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= WIDTH) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)

  const border = c.border('┌' + '─'.repeat(WIDTH + 2) + '┐')
  const bottom = c.border('└' + '─'.repeat(WIDTH + 2) + '┘')
  const body   = lines
    .map(l => c.border('│') + ' ' + colorFn(l.padEnd(WIDTH)) + ' ' + c.border('│'))
    .join('\n  ')

  console.log(`  ${border}`)
  console.log(`  ${body}`)
  console.log(`  ${bottom}`)
}

function printCharCount(len) {
  const max   = 280
  const pct   = len / max
  const bar   = buildBar(pct, 30)
  const label = pct < 0.85 ? c.count.ok(`${len}/${max}`)
              : pct < 1.0  ? c.count.warn(`${len}/${max}`)
              :               c.count.over(`${len}/${max} OVER LIMIT`)

  console.log(`  ${c.dim('chars:')} ${label}  ${c.dim(bar)}`)
}

function buildBar(pct, width) {
  const filled = Math.round(Math.min(pct, 1) * width)
  const color  = pct < 0.85 ? chalk.green : pct < 1 ? chalk.yellow : chalk.red
  return '[' + color('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled)) + ']'
}
