import fs from 'node:fs/promises'
import path from 'node:path'
import * as cheerio from 'cheerio'

const ARCHIVE_INDEX_URL = 'https://www.trivialstudies.com/jeopardy'

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName)
  if (index === -1) {
    return null
  }

  return process.argv[index + 1] ?? null
}

const studyPath = getArgValue('--path')
const outputName = getArgValue('--output')

if (!studyPath || !outputName) {
  console.error(
    'Usage: node scripts/parseStudyPage.mjs --path <study_path> --output <output_name>'
  )
  process.exit(1)
}

const studyUrl = new URL(studyPath, ARCHIVE_INDEX_URL).toString()

async function fetchStudyPage() {
  const response = await fetch(studyUrl)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch study page: ${response.status} ${response.statusText}`
    )
  }

  return response.text()
}

async function saveRawHtml(html) {
  const outputPath = path.resolve(`data/raw/${outputName}-study-page.html`)
  await fs.writeFile(outputPath, html, 'utf8')
  return outputPath
}

function cleanText(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripGlobalArtifacts(text) {
  return text
    .replace(/Season\s+\d+/gi, ' ')
    .replace(/Season\s+SUPERJEOPARDY/gi, ' ')
    .replace(
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}/gi,
      ' '
    )
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

function extractQuotedClue(text) {
  const match = text.match(/"([^"]+)"/)
  return match ? match[1].trim() : null
}

function extractCleanClue(rawText) {
  const quoted = extractQuotedClue(rawText)
  if (quoted) {
    return quoted
  }

  let cleaned = stripGlobalArtifacts(rawText)
  cleaned = cleanText(cleaned)

  // remove large all-caps category fragments that survive cleanup
  cleaned = cleaned.replace(/\b[A-Z&' /-]{5,}\b/g, ' ')
  cleaned = cleanText(cleaned)

  // remove leading punctuation / number fragments after cleanup
  cleaned = cleaned
    .replace(/^,\d+\s*/g, '')
    .replace(/^[\W_]+/g, '')
    .trim()

  return cleaned
}

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
  // Concatenation artifacts like "BroadwayRIVER"
  if (/[a-z][A-Z]{2,}/.test(clue) || /[a-z][A-Z]{2,}/.test(response)) return false
  // Require at least 1 non-stop lowercase content word — proves sentence structure, not a bare title
  const contentWords = words.slice(1).filter(w => {
    const bare = w.toLowerCase().replace(/[^a-z]/g, '')
    return bare.length > 2 && /^[a-z]/.test(w) && !STOP_WORDS.has(bare)
  })
  return contentWords.length >= 1
}

function extractStudyClues(html) {
  const $ = cheerio.load(html)
  const clues = []

  $('tr.qrow').each((_, row) => {
    const questionCell = $(row).find('td[id^="question_"]').first()

    if (!questionCell.length) {
      return
    }

    const answerElement = questionCell.find('div[id^="ans_"]').first()
    const response = cleanText(answerElement.text())

    if (!response) {
      return
    }

    const clueContainer = questionCell.find('div.mouse_pointer').first().clone()
    clueContainer.find('div[id^="ans_"]').remove()

    const rawText = cleanText(clueContainer.text())
    const clue = extractCleanClue(rawText)

    if (!looksUsable(clue, response)) {
      return
    }

    clues.push({
      clue,
      response,
    })
  })

  return clues
}

async function saveProcessedClues(clues) {
  const outputPath = path.resolve(`backend/data/processed/${outputName}-study-clues.json`)
  await fs.writeFile(outputPath, JSON.stringify(clues, null, 2), 'utf8')
  return outputPath
}

async function main() {
  console.log(`Fetching study page from ${studyUrl}...`)
  const html = await fetchStudyPage()

  const rawHtmlPath = await saveRawHtml(html)
  console.log(`Saved raw HTML to ${rawHtmlPath}`)

  const clues = extractStudyClues(html)
  console.log(`Extracted ${clues.length} clues`)

  const processedPath = await saveProcessedClues(clues)
  console.log(`Saved processed clues to ${processedPath}`)

  console.log('\nSample clues:')
  clues.slice(0, 10).forEach((clue, index) => {
    console.log(`${index + 1}. ${clue.clue}`)
    console.log(`   → ${clue.response}`)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})