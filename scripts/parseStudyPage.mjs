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

function stripMetadata(text) {
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
    .replace(/[A-Z][A-Z\s&/'-]{8,}/g, ' ')
}

function stripLeadingArtifacts(text) {
  let cleaned = text

  const patterns = [
    /^#\d+\.\s*/i,
    /^#\d+\s*/i,
    /^,\d+\s*/i,
    /^\$\d+\s*/i,
    /^[.'",:;!?-]+\s*/i,
    /^[A-Z]+Double\s*/i,
    /^[A-Z]+Title\s*/i,
    /^[A-Z]+Round\s*/i,
    /^[A-Z]+Jeopardy\s*/i,
    /^[A-Z]{4,}\s*/i,
    /^ouble\s+/i,
    /^ever\s+/i,
    /^egan\s+/i,
    /^Title\s+/i,
    /^Round\s+/i,
    /^Double\s+/i,
    /^DR\.\s*PHIL,\s*/i,
    /^DR\.\s*/i,
  ]

  let changed = true

  while (changed) {
    changed = false

    cleaned = cleaned.trim()

    for (const pattern of patterns) {
      const next = cleaned.replace(pattern, '')
      if (next !== cleaned) {
        cleaned = next.trim()
        changed = true
      }
    }
  }

  return cleaned
}

function normalizeClueText(text) {
  let cleaned = stripMetadata(text)
  cleaned = cleanText(cleaned)
  cleaned = stripLeadingArtifacts(cleaned)

  cleaned = cleaned
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\s+:/g, ':')
    .replace(/\s+;/g, ';')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()

  return cleaned
}

function extractQuotedClue(text) {
  const match = text.match(/"([^"]+)"/)
  return match ? match[1].trim() : null
}

function extractClueSentence(text) {
  const quotedClue = extractQuotedClue(text)
  if (quotedClue) {
    return quotedClue
  }

  return normalizeClueText(text)
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
    const clue = extractClueSentence(rawText)

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
  clues.slice(0, 5).forEach((clue, index) => {
    console.log(`${index + 1}. ${clue.clue}`)
    console.log(`   → ${clue.response}`)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})