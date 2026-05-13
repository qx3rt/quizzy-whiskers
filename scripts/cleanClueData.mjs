/**
 * Post-process all clue JSON files in backend/data/processed/ with improved
 * validation filters.  Overwrites each file in place.
 *
 * Run from repo root:
 *   node scripts/cleanClueData.mjs
 *
 * Options:
 *   --dry-run   Report what would be removed without writing files
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const DATA_DIR = path.resolve('backend/data/processed')
const DRY_RUN = process.argv.includes('--dry-run')

const STOP_WORDS = new Set([
  'a','an','the','of','in','on','at','to','by','for','or','and','but','as',
  'it','its','from','with','up','out','not','no','so','yet','nor','via','vs',
  'into','over','under','about','around','between','within','through','across',
  'before','after','during','upon','toward','than','like','off','onto','per',
])

function looksUsable(clue, response) {
  if (!clue || !response) return false
  const words = clue.split(/\s+/).filter(Boolean)
  if (clue.length < 20 || words.length < 5) return false
  if (/Double/i.test(clue) || /Season /i.test(clue) || /\b\d{4}\b/.test(clue) || /,\d{3}/.test(clue)) return false
  // Reject overly long responses (likely category bleed artifact)
  if (response.split(/\s+/).filter(Boolean).length > 6) return false
  // Concatenation artifacts like "BroadwayRIVER" or "AFTERDouble"
  if (/[a-z][A-Z]{2,}/.test(clue) || /[a-z][A-Z]{2,}/.test(response)) return false
  // Must have at least 1 non-stop lowercase content word — proves sentence structure, not a bare title
  const contentWords = words.slice(1).filter(w => {
    const bare = w.toLowerCase().replace(/[^a-z]/g, '')
    return bare.length > 2 && /^[a-z]/.test(w) && !STOP_WORDS.has(bare)
  })
  if (contentWords.length < 1) return false
  return true
}

async function main() {
  const files = (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('-study-clues.json'))
  files.sort()

  let totalBefore = 0
  let totalAfter = 0

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file)
    const raw = await fs.readFile(filePath, 'utf8')
    const clues = JSON.parse(raw)
    const cleaned = clues.filter(c => looksUsable(c.clue, c.response))

    const removed = clues.length - cleaned.length
    const pct = Math.round(100 * cleaned.length / clues.length)
    const label = file.replace('-study-clues.json', '')
    console.log(`${label}: ${clues.length} → ${cleaned.length} (${pct}%, -${removed})`)

    totalBefore += clues.length
    totalAfter += cleaned.length

    if (!DRY_RUN) {
      await fs.writeFile(filePath, JSON.stringify(cleaned, null, 2), 'utf8')
    }
  }

  const totalRemoved = totalBefore - totalAfter
  const totalPct = Math.round(100 * totalAfter / totalBefore)
  console.log(`\nTotal: ${totalBefore} → ${totalAfter} (${totalPct}%, -${totalRemoved} removed)`)
  if (DRY_RUN) console.log('\n(dry run — no files written)')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
