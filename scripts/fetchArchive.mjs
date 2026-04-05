import fs from 'node:fs/promises'
import path from 'node:path'
import * as cheerio from 'cheerio'

const ARCHIVE_URL = 'https://www.trivialstudies.com/jeopardy'
const BASE_URL = 'https://www.trivialstudies.com/jeopardy/'

async function fetchArchivePage() {
  const response = await fetch(ARCHIVE_URL)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch archive page: ${response.status} ${response.statusText}`
    )
  }

  return response.text()
}

async function saveRawHtml(html) {
  const outputPath = path.resolve('data/raw/jeopardy-archive-index.html')
  await fs.writeFile(outputPath, html, 'utf8')
  return outputPath
}

function extractHrefFromOnclick(onclickValue) {
  if (!onclickValue) {
    return null
  }

  const match = onclickValue.match(/window\.location\.href='([^']+)'/)
  if (!match) {
    return null
  }

  return match[1]
}

function toAbsoluteUrl(relativePath) {
  return new URL(relativePath, BASE_URL).toString()
}

function extractArchiveEntries(html) {
  const $ = cheerio.load(html)
  const entries = []

  $('tr').each((_, row) => {
    const labelCell = $(row).find('td.data_cell').first()

    if (!labelCell.length) {
      return
    }

    const label = labelCell.text().replace(/\s+/g, ' ').trim()

    if (!label) {
      return
    }

    const linkCells = $(row).find('td.link_cell')
    if (!linkCells.length) {
      return
    }

    const entry = {
      label,
      links: {},
    }

    linkCells.each((_, cell) => {
      const linkType = $(cell).text().replace(/\s+/g, ' ').trim().toLowerCase()
      const onclickValue = $(cell).attr('onclick')
      const relativePath = extractHrefFromOnclick(onclickValue)

      if (!linkType || !relativePath) {
        return
      }

      entry.links[linkType] = {
        relativePath,
        absoluteUrl: toAbsoluteUrl(relativePath),
      }
    })

    if (Object.keys(entry.links).length > 0) {
      entries.push(entry)
    }
  })

  return entries
}

async function saveArchiveInventory(entries) {
  const outputPath = path.resolve('data/processed/archive-link-inventory.json')
  await fs.writeFile(outputPath, JSON.stringify(entries, null, 2), 'utf8')
  return outputPath
}

async function main() {
  console.log(`Fetching archive index from ${ARCHIVE_URL}...`)
  const html = await fetchArchivePage()

  const rawHtmlPath = await saveRawHtml(html)
  console.log(`Saved raw HTML to ${rawHtmlPath}`)

  const entries = extractArchiveEntries(html)
  console.log(`Extracted ${entries.length} archive entries from index`)

  const inventoryPath = await saveArchiveInventory(entries)
  console.log(`Saved archive inventory to ${inventoryPath}`)

  console.log('\nSample archive entries:')
  entries.slice(0, 10).forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.label}`)

    Object.entries(entry.links).forEach(([type, linkData]) => {
      console.log(`   - ${type}: ${linkData.relativePath}`)
    })
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})