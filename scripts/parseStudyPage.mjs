import fs from 'node:fs/promises'
import path from 'node:path'
import * as cheerio from 'cheerio'

const ARCHIVE_INDEX_URL = 'https://www.trivialstudies.com/jeopardy'
const STUDY_PATH = 'study_53670101&shuffle=true'
const STUDY_URL = new URL(STUDY_PATH, ARCHIVE_INDEX_URL).toString()

async function fetchStudyPage() {
  const response = await fetch(STUDY_URL)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch study page: ${response.status} ${response.statusText}`
    )
  }

  return response.text()
}

async function saveRawHtml(html) {
  const outputPath = path.resolve('data/raw/shakespeare-study-page.html')
  await fs.writeFile(outputPath, html, 'utf8')
  return outputPath
}

function cleanText(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function removeKnownMetadata(text) {
  return text
    .replace(/Season\s+\d+/gi, ' ')
    .replace(
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}/gi,
      ' '
    )
    .replace(/Jeopardy Round:\s*Daily Double\s*[-–—]?\s*\$\d+/gi, ' ')
    .replace(/Double Jeopardy Round:\s*Daily Double\s*[-–—]?\s*\$\d+/gi, ' ')
    .replace(/Jeopardy Round:\s*\$\d+/gi, ' ')
    .replace(/Double Jeopardy Round:\s*\$\d+/gi, ' ')
    .replace(/Final Jeopardy/gi, ' ')
    .replace(/\bDaily Double\b/gi, ' ')
    .replace(/\bSHAKESPEAREAN QUOTES\b/gi, ' ')
    .replace(/\bSHAKESPEAREAN TRIVIA\b/gi, ' ')
    .replace(/\bJESTERDAY\b/gi, ' ')
    .replace(/\bTHE END\b/gi, ' ')
    .replace(/\bTHEATRE\b/gi, ' ')
    .replace(/\bIN THE TV KITCHEN\b/gi, ' ')
}

function normalizeLeadingNumbering(text) {
  return text
    .replace(/^#\d+\.\s*/i, '')
    .replace(/^#\d+\s*/i, '')
    .replace(/^\$\d+\s*/i, '')
    .replace(/^,\d+\s*/i, '')
    .replace(/^[\s.,;:!?'"-]+/, '')
    .trim()
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

  let cleaned = removeKnownMetadata(rawText)
  cleaned = cleanText(cleaned)
  cleaned = normalizeLeadingNumbering(cleaned)

  // Remove obvious all-caps category blocks only when they are separated cleanly
  cleaned = cleaned.replace(/\b[A-Z][A-Z&/' -]{6,}\b/g, ' ')
  cleaned = cleanText(cleaned)
  cleaned = normalizeLeadingNumbering(cleaned)

  return cleaned
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

    if (!clue) {
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
  const outputPath = path.resolve(
    'data/processed/shakespeare-study-clues.json'
  )
  await fs.writeFile(outputPath, JSON.stringify(clues, null, 2), 'utf8')
  return outputPath
}

async function main() {
  console.log(`Fetching study page from ${STUDY_URL}...`)
  const html = await fetchStudyPage()

  const rawHtmlPath = await saveRawHtml(html)
  console.log(`Saved raw HTML to ${rawHtmlPath}`)

  const clues = extractStudyClues(html)
  console.log(`Extracted ${clues.length} clean clues`)

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