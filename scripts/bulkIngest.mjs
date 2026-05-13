/**
 * Bulk ingest all thematic categories from the trivialstudies.com archive.
 *
 * Run from repo root:
 *   node scripts/bulkIngest.mjs
 *
 * Options:
 *   --dry-run   Print what would be fetched without hitting the network
 *   --delay N   Milliseconds between requests (default: 2000)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import * as cheerio from 'cheerio'

const ARCHIVE_ROOT_URL = 'https://www.trivialstudies.com'
const INVENTORY_PATH = path.resolve('data/processed/archive-link-inventory.json')
const OUTPUT_DIR = path.resolve('backend/data/processed')

const DRY_RUN = process.argv.includes('--dry-run')
const DELAY_MS = (() => {
  const i = process.argv.indexOf('--delay')
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : 2000
})()

// Maps archive label → { name, slug } for all 42 thematic categories.
// Entries after "All Technology Clues" in the inventory are seasons — excluded here.
const THEMATIC_CATEGORY_MAP = {
  'All Final Jeopardy! Clues':  { name: 'Final Jeopardy',    slug: 'final-jeopardy' },
  'All Literature Clues':       { name: 'Literature',         slug: 'literature' },
  'All Poetry Clues':           { name: 'Poetry',             slug: 'poetry' },
  'All Shakespeare Clues':      { name: 'Shakespeare',        slug: 'shakespeare' },
  'All Charles Dickens Clues':  { name: 'Charles Dickens',    slug: 'charles-dickens' },
  'All Jane Austen Clues':      { name: 'Jane Austen',        slug: 'jane-austen' },
  'All Broadway Clues':         { name: 'Broadway',           slug: 'broadway' },
  'All Opera Clues':            { name: 'Opera',              slug: 'opera' },
  'All Ballet Clues':           { name: 'Ballet',             slug: 'ballet' },
  'All Classical Music Clues':  { name: 'Classical Music',    slug: 'classical-music' },
  'All Television Clues':       { name: 'Television',         slug: 'television' },
  'All Movie Clues':            { name: 'Movies',             slug: 'movies' },
  'All Disney Clues':           { name: 'Disney',             slug: 'disney' },
  'All Music Clues':            { name: 'Music',              slug: 'music' },
  'All Art & Artists Clues':    { name: 'Art & Artists',      slug: 'art-and-artists' },
  'All Architecture Clues':     { name: 'Architecture',       slug: 'architecture' },
  'All Mythology Clues':        { name: 'Mythology',          slug: 'mythology' },
  'All Philosophy Clues':       { name: 'Philosophy',         slug: 'philosophy' },
  'All Bible Clues':            { name: 'Bible',              slug: 'bible' },
  'All History Clues':          { name: 'History',            slug: 'history' },
  'All President Clues':        { name: 'Presidents',         slug: 'presidents' },
  'All War Clues':              { name: 'War',                slug: 'war' },
  'All Nobel Prize Clues':      { name: 'Nobel Prize',        slug: 'nobel-prize' },
  'All Geography Clues':        { name: 'Geography',          slug: 'geography' },
  'All Capitals Clues':         { name: 'Capitals',           slug: 'capitals' },
  'All Baseball Clues':         { name: 'Baseball',           slug: 'baseball' },
  'All Basketball Clues':       { name: 'Basketball',         slug: 'basketball' },
  'All Football Clues':         { name: 'Football',           slug: 'football' },
  'All Hockey Clues':           { name: 'Hockey',             slug: 'hockey' },
  'All Olympic Clues':          { name: 'Olympics',           slug: 'olympics' },
  'All Soccer Clues':           { name: 'Soccer',             slug: 'soccer' },
  'All Boxing Clues':           { name: 'Boxing',             slug: 'boxing' },
  'All Horse Racing Clues':     { name: 'Horse Racing',       slug: 'horse-racing' },
  'All Golf Clues':             { name: 'Golf',               slug: 'golf' },
  'All Auto Racing Clues':      { name: 'Auto Racing',        slug: 'auto-racing' },
  'All Potent Potables Clues':  { name: 'Potent Potables',    slug: 'potent-potables' },
  'All Chemistry Clues':        { name: 'Chemistry',          slug: 'chemistry' },
  'All Physics Clues':          { name: 'Physics',            slug: 'physics' },
  'All Biology Clues':          { name: 'Biology',            slug: 'biology' },
  'All Astronomy Clues':        { name: 'Astronomy',          slug: 'astronomy' },
  'All Business Clues':         { name: 'Business',           slug: 'business' },
  'All Technology Clues':       { name: 'Technology',         slug: 'technology' },
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function cleanText(text) {
  return text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

// Lowercase words that do not indicate sentence structure (prepositions, articles, conjunctions)
const STOP_WORDS = new Set([
  'a','an','the','of','in','on','at','to','by','for','or','and','but','as',
  'it','its','from','with','up','out','not','no','so','yet','nor','via','vs',
  'into','over','under','about','around','between','within','through','across',
  'before','after','during','upon','toward','than','like','off','onto','per',
])

function stripGlobalArtifacts(text) {
  return text
    .replace(/Season\s+\d+/gi, ' ')
    .replace(/Season\s+SUPERJEOPARDY/gi, ' ')
    .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}/gi, ' ')
    .replace(/SUPERJEOPARDY/gi, ' ')
    .replace(/Jeopardy Round:\s*Daily Double\s*[-–—]?\s*\$?\d+/gi, ' ')
    .replace(/Double Jeopardy Round:\s*Daily Double\s*[-–—]?\s*\$?\d+/gi, ' ')
    .replace(/Jeopardy Round:\s*\$?\d+/gi, ' ')
    .replace(/Double Jeopardy Round:\s*\$?\d+/gi, ' ')
    .replace(/Final Jeopardy/gi, ' ')
    .replace(/\bDaily Double\b/gi, ' ')
    .replace(/[A-Z&' /-]{4,}Double/gi, ' ')
    .replace(/,\d{3}/g, ' ')
    .replace(/^#\d+\.\s*/g, ' ')
    .replace(/^#\d+\s*/g, ' ')
    // Strip leading all-caps category name fragments like "TOP 10 " or "OUT OF "
    .replace(/^(?:[A-Z]{2,}\s+|\d+\s+){1,5}(?=[A-Z][a-z]|[a-z])/, '')
}

function extractCleanClue(rawText) {
  const quoted = rawText.match(/"([^"]+)"/)
  if (quoted) return quoted[1].trim()

  let cleaned = stripGlobalArtifacts(rawText)
  cleaned = cleanText(cleaned)
  cleaned = cleaned.replace(/\b[A-Z&' /-]{5,}\b/g, ' ')
  cleaned = cleanText(cleaned)
  cleaned = cleaned.replace(/^,\d+\s*/g, '').replace(/^[\W_]+/g, '').trim()
  return cleaned
}

function looksUsable(clue, response) {
  if (!clue || !response) return false
  const words = clue.split(/\s+/).filter(Boolean)
  // Minimum size for a real Jeopardy clue
  if (clue.length < 20 || words.length < 5) return false
  // Known artifact patterns
  if (/Double/i.test(clue) || /Season /i.test(clue) || /\b\d{4}\b/.test(clue) || /,\d{3}/.test(clue)) return false
  // Reject overly long responses (likely category bleed artifact)
  if (response.split(/\s+/).filter(Boolean).length > 6) return false
  // Concatenation artifact: lowercase letter immediately followed by 2+ uppercase (e.g. "BroadwayRIVER")
  if (/[a-z][A-Z]{2,}/.test(clue) || /[a-z][A-Z]{2,}/.test(response)) return false
  // Require at least 1 non-stop lowercase content word (proves sentence structure, not a bare title)
  const contentWords = words.slice(1).filter(w => {
    const bare = w.toLowerCase().replace(/[^a-z]/g, '')
    return bare.length > 2 && /^[a-z]/.test(w) && !STOP_WORDS.has(bare)
  })
  if (contentWords.length < 1) return false
  return true
}

function extractClues(html) {
  const $ = cheerio.load(html)
  const clues = []

  $('tr.qrow').each((_, row) => {
    const questionCell = $(row).find('td[id^="question_"]').first()
    if (!questionCell.length) return

    const answerElement = questionCell.find('div[id^="ans_"]').first()
    const response = cleanText(answerElement.text())
    if (!response) return

    const clueContainer = questionCell.find('div.mouse_pointer').first().clone()
    clueContainer.find('div[id^="ans_"]').remove()
    const clue = extractCleanClue(cleanText(clueContainer.text()))

    if (looksUsable(clue, response)) {
      clues.push({ clue, response })
    }
  })

  return clues
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function fetchAndParse(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  const html = await response.text()
  return extractClues(html)
}

async function main() {
  // Load inventory
  const inventory = JSON.parse(await fs.readFile(INVENTORY_PATH, 'utf8'))

  // Filter to thematic entries that exist in our map
  const targets = inventory
    .filter(entry => entry.label in THEMATIC_CATEGORY_MAP && entry.links?.study?.relativePath)
    .map(entry => ({
      label: entry.label,
      url: `${ARCHIVE_ROOT_URL}/${entry.links.study.relativePath}`,
      ...THEMATIC_CATEGORY_MAP[entry.label],
    }))

  console.log(`Found ${targets.length} thematic categories to process\n`)

  let fetched = 0
  let skipped = 0
  let failed = 0

  for (const [i, target] of targets.entries()) {
    const outputPath = path.join(OUTPUT_DIR, `${target.slug}-study-clues.json`)
    const alreadyExists = await fileExists(outputPath)

    const prefix = `[${String(i + 1).padStart(2, '0')}/${targets.length}]`

    if (alreadyExists) {
      const existing = JSON.parse(await fs.readFile(outputPath, 'utf8'))
      console.log(`${prefix} SKIP  ${target.name} (${existing.length} clues already on disk)`)
      skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`${prefix} DRY   ${target.name} → ${target.url}`)
      continue
    }

    try {
      console.log(`${prefix} FETCH ${target.name} …`)
      const clues = await fetchAndParse(target.url)
      await fs.writeFile(outputPath, JSON.stringify(clues, null, 2), 'utf8')
      console.log(`${prefix}       → ${clues.length} clues saved`)
      fetched++
    } catch (err) {
      console.error(`${prefix} FAIL  ${target.name}: ${err.message}`)
      failed++
    }

    if (i < targets.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\nDone. Fetched: ${fetched}  Skipped: ${skipped}  Failed: ${failed}`)
  if (fetched > 0) {
    console.log('\nNext step: commit the new JSON files and push to main.')
    console.log('Railway will auto-sync the new categories on next deploy.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
