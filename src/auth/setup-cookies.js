/**
 * One-time setup: extract your Twitter session cookies from the browser
 * and save them so the bot can authenticate without username/password login.
 *
 * Run: node src/auth/setup-cookies.js
 */
import { input } from '@inquirer/prompts'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COOKIES_PATH = path.join(__dirname, '../../data/cookies.json')

console.log()
console.log(chalk.bold.cyan('┌─────────────────────────────────────────────────┐'))
console.log(chalk.bold.cyan('│') + chalk.bold('  🍪  x-EchoMind — Cookie Setup               ') + chalk.bold.cyan('│'))
console.log(chalk.bold.cyan('└─────────────────────────────────────────────────┘'))
console.log()
console.log(chalk.bold('How to get your Twitter cookies:'))
console.log()
console.log(chalk.dim('1.') + ' Open ' + chalk.cyan('https://x.com') + ' in your browser and log in')
console.log(chalk.dim('2.') + ' Press ' + chalk.bold('F12') + ' to open DevTools')
console.log(chalk.dim('3.') + ' Go to: ' + chalk.bold('Application') + ' → ' + chalk.bold('Cookies') + ' → ' + chalk.cyan('https://x.com'))
console.log(chalk.dim('4.') + ' Find the cookie named ' + chalk.yellow('auth_token') + ' — copy its Value')
console.log(chalk.dim('5.') + ' Find the cookie named ' + chalk.yellow('ct0') + ' — copy its Value')
console.log()
console.log(chalk.dim('Tip: in Chrome/Edge, you can also run this in the DevTools Console:'))
console.log(chalk.dim('  document.cookie.split("; ").filter(c => c.startsWith("auth_token") || c.startsWith("ct0"))'))
console.log()

const authToken = await input({
  message: chalk.yellow('auth_token') + ' value:',
  validate: v => v.trim().length > 10 || 'Paste the full auth_token value',
})

const ct0 = await input({
  message: chalk.yellow('ct0') + ' value:',
  validate: v => v.trim().length > 10 || 'Paste the full ct0 value',
})

// Build cookie array in the format agent-twitter-client expects
const cookies = [
  buildCookie('auth_token', authToken.trim()),
  buildCookie('ct0', ct0.trim()),
  buildCookie('twid', `u%3D0`), // placeholder — scraper will update
]

fs.mkdirSync(path.dirname(COOKIES_PATH), { recursive: true })
fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2))

console.log()
console.log(chalk.bold.greenBright('✅  Cookies saved to data/cookies.json'))
console.log(chalk.dim('   Run npm start to launch the bot.'))
console.log()

function buildCookie(name, value) {
  return {
    name,
    value,
    domain: '.x.com',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'None',
  }
}
