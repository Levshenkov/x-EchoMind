/**
 * Persona loader — builds a single system-prompt string from config/persona.json.
 * Cached after first load; restart the process to pick up edits.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PERSONA_PATH = path.join(__dirname, '..', 'config', 'persona.json')

let cached = null

function load() {
  if (cached) return cached
  const raw = readFileSync(PERSONA_PATH, 'utf8')
  cached = build(JSON.parse(raw))
  return cached
}

function build(p) {
  const sections = []

  if (p.identity) {
    sections.push(`Identity:\n${p.identity}`)
  }

  if (p.worldview?.length) {
    sections.push(
      `Worldview (apply these standing beliefs to every post):\n${p.worldview.map(b => `- ${b}`).join('\n')}`
    )
  }

  const prefer = p.vocabulary?.prefer ?? []
  const avoid  = p.vocabulary?.avoid  ?? []
  if (prefer.length || avoid.length) {
    const lines = []
    if (prefer.length) lines.push(`Prefer these terms when relevant: ${prefer.join(', ')}.`)
    if (avoid.length)  lines.push(`Never use these terms: ${avoid.join(', ')}.`)
    sections.push(`Vocabulary:\n${lines.join('\n')}`)
  }

  if (p.nevers?.length) {
    sections.push(`Hard rules (never violate, regardless of tone or topic):\n${p.nevers.map(n => `- ${n}`).join('\n')}`)
  }

  if (p.voice?.length) {
    sections.push(`Voice and sentence shape:\n${p.voice.map(v => `- ${v}`).join('\n')}`)
  }

  sections.push(
    'These are standing rules. A per-call tone or topic style may adjust how you express this persona, but never overrides the worldview, hard rules, or vocabulary.'
  )

  return sections.join('\n\n')
}

/** Returns the assembled system prompt string for the persona. */
export function personaPrompt() {
  return load()
}
