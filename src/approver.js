/**
 * Human-in-the-loop approval for all bot actions.
 * Pauses before every post/reply/quote and asks for confirmation.
 * Options: Approve → post as-is | Edit → modify text then post | Skip → discard
 */
import { select, input, confirm } from '@inquirer/prompts'
import logger from './logger.js'

const DIVIDER = '─'.repeat(60)

/**
 * Prompt the user to approve, edit, or skip a generated action.
 *
 * @param {object} opts
 * @param {'tweet'|'reply'|'quote'} opts.type   - Action type
 * @param {string}  opts.text                   - Generated text to review
 * @param {object}  [opts.targetTweet]          - For reply/quote: the original tweet
 * @param {string}  opts.topic                  - Topic name for context
 *
 * @returns {{ action: 'post'|'skip', text: string }}
 */
export async function approveAction({ type, text, targetTweet, topic }) {
  // Non-interactive mode (e.g. piped stdin) — auto-skip to avoid hanging
  if (!process.stdin.isTTY) {
    logger.warn('Approver: non-interactive mode — skipping action (no TTY)')
    return { action: 'skip', text }
  }

  console.log('\n' + DIVIDER)
  console.log(formatHeader(type, targetTweet, topic))

  if (targetTweet) {
    console.log(`\n  Original tweet by @${targetTweet.author}:`)
    console.log(`  "${targetTweet.text}"`)
  }

  console.log(`\n  Generated ${type}:`)
  console.log(formatBox(text))
  console.log(`  Length: ${text.length}/280 characters`)
  console.log(DIVIDER)

  const choice = await select({
    message: 'What do you want to do?',
    choices: [
      { name: '✅  Approve — post as-is', value: 'approve' },
      { name: '✏️   Edit — modify before posting', value: 'edit' },
      { name: '⏭️   Skip — discard this action', value: 'skip' },
    ],
  })

  if (choice === 'skip') {
    console.log('  Skipped.\n')
    return { action: 'skip', text }
  }

  if (choice === 'edit') {
    const edited = await input({
      message: 'Edit the text (max 280 chars):',
      default: text,
      validate: val => {
        if (!val.trim()) return 'Text cannot be empty'
        if (val.length > 280) return `Too long: ${val.length}/280 characters`
        return true
      },
    })

    console.log(`\n  Final text (${edited.length} chars):`)
    console.log(formatBox(edited))

    const confirmed = await confirm({ message: 'Post this?', default: true })
    if (!confirmed) {
      console.log('  Skipped.\n')
      return { action: 'skip', text: edited }
    }

    console.log('  Approved (edited).\n')
    return { action: 'post', text: edited }
  }

  // approve
  console.log('  Approved.\n')
  return { action: 'post', text }
}

function formatHeader(type, targetTweet, topic) {
  const labels = {
    tweet: `📝  NEW TWEET  —  topic: "${topic}"`,
    reply: `💬  REPLY  —  to @${targetTweet?.author}  —  topic: "${topic}"`,
    quote: `🔁  QUOTE TWEET  —  @${targetTweet?.author}  —  topic: "${topic}"`,
  }
  return labels[type] ?? `Action — topic: "${topic}"`
}

function formatBox(text) {
  const lines = text.match(/.{1,56}/g) ?? [text]
  const border = '┌' + '─'.repeat(58) + '┐'
  const bottom = '└' + '─'.repeat(58) + '┘'
  const body = lines.map(l => `│ ${l.padEnd(56)} │`).join('\n')
  return `  ${border}\n  ${body}\n  ${bottom}`
}
