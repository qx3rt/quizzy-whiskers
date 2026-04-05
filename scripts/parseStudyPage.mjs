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
  const outputPath = path.resolve(`data/processed/${outputName}-study-clues.json`)
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
  clues.slice(0, 5).forEach((clue, index) => {
    console.log(`${index + 1}. ${clue.clue}`)
    console.log(`   → ${clue.response}`)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})