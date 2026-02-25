/**
 * Available tones for content generation.
 * Each tone has a display label, an emoji, and an AI prompt instruction
 * that gets injected into the generator prompts.
 */
export const TONES = [
  {
    value: 'serious',
    icon: '💡',
    label: 'Serious / Insightful',
    instruction: 'Write in a serious, thoughtful tone. Be precise and substantive. No jokes, no fluff — pure insight.',
  },
  {
    value: 'technical',
    icon: '🔧',
    label: 'Technical / Precise',
    instruction: 'Write in a technical, expert tone. Use accurate terminology, be specific, show depth of knowledge. Assume the reader is technically literate.',
  },
  {
    value: 'humorous',
    icon: '😄',
    label: 'Humorous / Joke',
    instruction: 'Write in a witty, funny tone. Be genuinely clever — not cheesy. A good joke or pun is fine. Make the reader smile or laugh.',
  },
  {
    value: 'sarcastic',
    icon: '😏',
    label: 'Sarcastic',
    instruction: 'Write with dry, sharp sarcasm. Subtle is better than obvious. The irony should land naturally — not forced. Do not over-explain the joke.',
  },
  {
    value: 'contrarian',
    icon: '🔥',
    label: 'Contrarian / Bold',
    instruction: 'Take a strong, confident, slightly provocative stance that challenges conventional wisdom. Be bold but back it up with a real argument. Stir the conversation.',
  },
  {
    value: 'casual',
    icon: '💬',
    label: 'Casual / Friendly',
    instruction: 'Write in a relaxed, conversational tone — like texting a smart friend. No jargon, no formality. Warm and approachable.',
  },
  {
    value: 'educational',
    icon: '🎓',
    label: 'Educational',
    instruction: 'Write in a clear, informative tone as if explaining something to someone smart but new to the topic. Teach one concrete thing. Be clear, not condescending.',
  },
  {
    value: 'inspirational',
    icon: '✨',
    label: 'Inspirational',
    instruction: 'Write in an uplifting, motivating tone. Make the reader feel something. Avoid clichés — find a fresh angle that genuinely resonates.',
  },
]

/** Lookup a tone object by value. Returns null if not found. */
export function getTone(value) {
  return TONES.find(t => t.value === value) ?? null
}

/** Build the tone instruction string for prompt injection. Returns empty string if tone is null/unknown. */
export function toneInstruction(value) {
  const tone = getTone(value)
  return tone ? `\nTone: ${tone.instruction}` : ''
}
