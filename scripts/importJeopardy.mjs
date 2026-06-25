/**
 * Import authentic J-Archive clues from the jwolle1 GitHub dataset.
 *
 * Downloads combined_season1-41.tsv (~60MB), groups rows into episode
 * category-sets (one per board column from a real Jeopardy! game), tags
 * each with a topic area, and writes per-topic JSON files to
 * backend/data/jarchive/{topic}.json.
 *
 * Run from repo root:
 *   node scripts/importJeopardy.mjs
 *
 * Options:
 *   --dry-run    Parse and report counts without writing files
 *   --local FILE Use a local TSV file instead of downloading
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const TSV_URL =
  'https://raw.githubusercontent.com/jwolle1/jeopardy_clue_dataset/main/combined_season1-41.tsv'
const OUTPUT_DIR = path.resolve('backend/data/jarchive')
const DRY_RUN = process.argv.includes('--dry-run')

// Cap category-sets per topic to keep DB size manageable for sql.js in-memory loading.
// 300 × ~50 topics → ~15k category-sets → ~75k clues → ~60MB DB file
const MAX_PER_TOPIC = 300

const localFlagIdx = process.argv.indexOf('--local')
const LOCAL_FILE = localFlagIdx !== -1 ? process.argv[localFlagIdx + 1] : null

// ---------------------------------------------------------------------------
// Topic area tagging — keyword match on uppercased category name
// Priority: more-specific rules listed first
// ---------------------------------------------------------------------------

const TOPIC_RULES = [
  // Literary authors
  { topic: 'shakespeare',  keywords: ['SHAKESPEARE'] },
  { topic: 'dickens',      keywords: ['DICKENS'] },
  { topic: 'twain',        keywords: ['MARK TWAIN', 'TWAIN'] },
  { topic: 'austen',       keywords: ['JANE AUSTEN', 'AUSTEN'] },
  { topic: 'hemingway',    keywords: ['HEMINGWAY'] },
  { topic: 'poe',          keywords: [' POE '] },

  // Literature & poetry
  { topic: 'poetry',       keywords: ['POETRY', ' POEMS', 'POEM '] },
  { topic: 'literature',   keywords: ['LITERATURE', 'NOVELS', ' NOVEL ', 'AUTHORS', ' AUTHOR ', 'FICTION', 'LITERARY'] },

  // Performing arts
  { topic: 'broadway',     keywords: ['BROADWAY', 'MUSICAL', 'MUSICALS', 'TONY AWARD', 'TONY AWARDS'] },
  { topic: 'opera',        keywords: ['OPERA', 'OPERAS'] },
  { topic: 'ballet',       keywords: ['BALLET'] },
  { topic: 'classical',    keywords: ['CLASSICAL MUSIC', 'SYMPHONY', 'SYMPHONIES', 'COMPOSER', 'COMPOSERS', 'BEETHOVEN', 'MOZART', 'BACH'] },

  // Screen & TV
  { topic: 'movies',       keywords: ['MOVIE', 'MOVIES', 'FILM', 'FILMS', 'CINEMA', 'OSCAR', 'OSCARS', 'DIRECTOR', 'DIRECTORS', 'ACTOR', 'ACTRESS', 'ANIMATED FILM', 'BOX OFFICE'] },
  { topic: 'television',   keywords: ['TELEVISION', ' TV ', 'SITCOM', 'SITCOMS', 'EMMY', 'EMMYS', 'GAME SHOW', 'TALK SHOW', 'TV SHOW', 'SOAP OPERA'] },
  { topic: 'disney',       keywords: ['DISNEY'] },

  // Music
  { topic: 'music',        keywords: ['MUSIC', 'SONGS', ' SONG ', 'SINGER', 'SINGERS', 'BAND ', 'BANDS', 'ALBUM', 'ALBUMS', 'ROCK AND ROLL', 'ROCK \'N\' ROLL', 'JAZZ', 'BLUES', 'COUNTRY MUSIC', 'HIP HOP', 'RAP ', 'POP MUSIC'] },

  // Visual arts & architecture
  { topic: 'art',          keywords: ['PAINTING', 'PAINTINGS', 'SCULPTURE', 'SCULPTOR', 'MUSEUM', 'MUSEUMS', 'ARTIST', 'ARTISTS', 'FINE ART', 'MASTERPIECE'] },
  { topic: 'architecture', keywords: ['ARCHITECTURE', 'ARCHITECT', 'BUILDING', 'BUILDINGS', 'LANDMARK', 'LANDMARKS'] },

  // History & government
  { topic: 'presidents',   keywords: ['PRESIDENT', 'PRESIDENTS', 'WHITE HOUSE', 'COMMANDER IN CHIEF'] },
  { topic: 'royalty',      keywords: ['KING ', 'QUEEN ', 'KINGS ', 'QUEENS ', 'ROYALTY', 'MONARCHY', 'CROWN'] },
  { topic: 'war',          keywords: ['WAR ', ' WAR', 'WARS', 'BATTLE', 'BATTLES', 'MILITARY', 'WWII', 'WWI', 'CIVIL WAR', 'REVOLUTION'] },
  { topic: 'history',      keywords: ['HISTORY', 'HISTORICAL', 'ANCIENT', 'MEDIEVAL', 'CENTURY', 'EMPIRE', 'CIVILIZATION'] },
  { topic: 'politics',     keywords: ['POLITICS', 'POLITICAL', 'CONGRESS', 'SENATE', 'SUPREME COURT', 'ELECTION', 'CONSTITUTION'] },

  // Mythology & religion
  { topic: 'mythology',    keywords: ['MYTHOLOGY', 'MYTH', 'GODS', 'GODDESSES', 'GREEK GODS', 'ROMAN GODS', 'NORSE', 'GREEK HEROES', 'OLYMPUS'] },
  { topic: 'bible',        keywords: ['BIBLE', 'BIBLICAL', 'TESTAMENT', 'SCRIPTURE', 'GOSPEL', 'APOSTLE', 'PROPHET'] },
  { topic: 'religion',     keywords: ['RELIGION', 'RELIGIOUS', 'CHURCH', 'CHRISTIANITY', 'ISLAM', 'JUDAISM', 'BUDDHISM', 'HINDUISM'] },
  { topic: 'philosophy',   keywords: ['PHILOSOPHY', 'PHILOSOPHER', 'PHILOSOPHERS', 'ETHICS'] },

  // Science
  { topic: 'astronomy',    keywords: ['ASTRONOMY', 'ASTRONOMERS', 'PLANET', 'PLANETS', 'STARS', 'GALAXY', 'SPACE', 'NASA', 'CONSTELLATION', 'COMET', 'TELESCOPE'] },
  { topic: 'biology',      keywords: ['BIOLOGY', 'ANIMAL', 'ANIMALS', 'MAMMAL', 'MAMMALS', 'BIRDS', 'INSECTS', 'PLANTS', 'BOTANY', 'SPECIES', 'EVOLUTION', 'DNA'] },
  { topic: 'chemistry',    keywords: ['CHEMISTRY', 'ELEMENTS', 'CHEMICAL', 'PERIODIC TABLE', 'MOLECULE', 'COMPOUND'] },
  { topic: 'physics',      keywords: ['PHYSICS', 'PHYSICISTS', 'QUANTUM', 'RELATIVITY', 'GRAVITY', 'ENERGY'] },
  { topic: 'science',      keywords: ['SCIENCE', 'SCIENTIST', 'SCIENTISTS', 'INVENTION', 'INVENTIONS', 'INVENTOR', 'INVENTORS', 'DISCOVERY', 'DISCOVERIES', 'LABORATORY', 'EXPERIMENT', 'NOBEL PRIZE'] },
  { topic: 'medicine',     keywords: ['MEDICINE', 'MEDICAL', 'DOCTOR', 'ANATOMY', 'DISEASE', 'SURGERY', 'PHARMACY'] },

  // Geography
  { topic: 'geography',    keywords: ['GEOGRAPHY', 'GEOGRAPHICAL', 'CONTINENT', 'CONTINENTS', 'OCEAN', 'OCEANS', 'RIVER', 'RIVERS', 'MOUNTAIN', 'MOUNTAINS', 'LAKE', 'LAKES', 'DESERT', 'ISLAND', 'ISLANDS', 'PENINSULA'] },
  { topic: 'capitals',     keywords: ['CAPITAL', 'CAPITALS', 'CAPITAL CITY', 'CAPITAL CITIES'] },
  { topic: 'countries',    keywords: ['COUNTRY', 'COUNTRIES', 'NATION', 'NATIONS', 'FLAG', 'FLAGS'] },
  { topic: 'us-states',    keywords: ['U.S. STATE', 'U.S. STATES', 'AMERICAN STATE', 'STATE CAPITAL', 'THE GREAT STATE'] },
  { topic: 'cities',       keywords: ['CITY', 'CITIES'] },

  // Sports
  { topic: 'baseball',     keywords: ['BASEBALL', 'WORLD SERIES', 'MLB'] },
  { topic: 'football',     keywords: ['FOOTBALL', 'NFL', 'SUPER BOWL', 'QUARTERBACK'] },
  { topic: 'basketball',   keywords: ['BASKETBALL', 'NBA', 'MARCH MADNESS'] },
  { topic: 'hockey',       keywords: ['HOCKEY', 'NHL', 'STANLEY CUP'] },
  { topic: 'soccer',       keywords: ['SOCCER', 'WORLD CUP', 'FIFA', 'FOOTBALL CLUB'] },
  { topic: 'olympics',     keywords: ['OLYMPICS', 'OLYMPIC', 'OLYMPIAN', 'OLYMPIANS'] },
  { topic: 'golf',         keywords: ['GOLF', 'GOLFER', 'GOLFERS', 'THE MASTERS', 'PGA'] },
  { topic: 'boxing',       keywords: ['BOXING', 'BOXER', 'BOXERS', 'HEAVYWEIGHT'] },
  { topic: 'tennis',       keywords: ['TENNIS', 'WIMBLEDON', 'US OPEN'] },
  { topic: 'sports',       keywords: ['SPORTS', 'ATHLETE', 'ATHLETES', 'CHAMPION', 'CHAMPIONSHIP', 'HALL OF FAME', 'TROPHY', 'RACING', 'MARATHON'] },

  // Food & drink
  { topic: 'food',         keywords: ['FOOD', 'COOKING', 'CUISINE', 'CHEF', 'RECIPE', 'RESTAURANT', 'DISH', 'INGREDIENT', 'VEGETABLE', 'FRUIT', 'BREAD', 'CHEESE', 'SPICE', 'DESSERT', 'CAKE', 'WINE', 'BEER', 'COCKTAIL', 'BEVERAGE', 'POTENT POTABLE'] },

  // Business & economics
  { topic: 'business',     keywords: ['BUSINESS', 'COMPANY', 'COMPANIES', 'CORPORATION', 'STOCK MARKET', 'ECONOMY', 'ECONOMICS', 'FINANCE', 'BRAND', 'BRANDS', 'ENTREPRENEUR', 'CEO'] },
  { topic: 'technology',   keywords: ['TECHNOLOGY', 'COMPUTER', 'COMPUTERS', 'INTERNET', 'SOFTWARE', 'APP', 'SILICON VALLEY', 'DIGITAL', 'ARTIFICIAL INTELLIGENCE'] },

  // Language & words
  { topic: 'language',     keywords: ['LANGUAGE', 'LANGUAGES', 'WORD ', 'WORDS', 'VOCABULARY', 'GRAMMAR', 'LATIN ', 'ETYMOLOGY', 'SLANG', 'IDIOM'] },

  // People
  { topic: 'biography',    keywords: ['BIOGRAPHY', 'LIFE OF ', 'BORN IN', 'FAMOUS '] },
]

// Categories to skip — word or phrase games that don't stand on their own
const GAME_MECHANIC_PATTERNS = [
  /BEFORE AND AFTER/,
  /RHYME TIME/,
  /HODGEPODGE/,
  /\bSTARTS WITH\b/,
  /\bENDS WITH\b/,
  /\bCONTAINS\b/,
  /\bANAGRAM/,
  /\bPOTPOURRI\b/,
  /\bWORD(?:PLAY|PLAY)\b/,
  /\bMISSING WORD/,
  /\bFILL[- ]IN\b/,
  /\bQUOTATION\b/,
  /___/,
  /\(A\)/,
  /\bIT'S A\b/,
  /\bTHINGS THAT\b/,
  /\bI HAVE A\b/,
]

function tagTopicArea(categoryName) {
  const upper = categoryName.toUpperCase()
  for (const rule of TOPIC_RULES) {
    if (rule.keywords.some(kw => upper.includes(kw))) {
      return rule.topic
    }
  }
  return 'misc'
}

function isGameMechanic(categoryName) {
  return GAME_MECHANIC_PATTERNS.some(re => re.test(categoryName.toUpperCase()))
}

// Strip HTML tags from clue text (J-Archive uses <i> for titles etc.)
function stripHtml(text) {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// Normalize dollar values: strip $, commas, "Daily Double"
function parseDollarValue(raw) {
  if (!raw || raw === 'None') return null
  const cleaned = raw.replace(/\$/g, '').replace(/,/g, '').replace(/Daily Double/i, '').trim()
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? null : n
}

function isValidClueSet(clues) {
  // Must have exactly 5 clues
  if (clues.length !== 5) return false

  // All clues must have non-empty question and answer
  if (clues.some(c => !c.clue_text || !c.response_text)) return false

  // Skip if any clue contains media cues (not playable in text)
  const mediaCue = /\[.*?\]|\(.*?audio.*?\)|\(.*?video.*?\)|\(.*?visual.*?\)/i
  if (clues.some(c => mediaCue.test(c.clue_text))) return false

  // Clues must span valid dollar values — check that all 5 are distinct
  const values = clues.map(c => c.dollar_value).filter(Boolean)
  if (new Set(values).size !== 5) return false

  return true
}

// Valid Jeopardy! dollar value sets (original and modern)
const VALID_J_VALUES = new Set([200, 400, 600, 800, 1000])
const VALID_DJ_VALUES = new Set([400, 800, 1200, 1600, 2000])

// Also handle older value sets
function normalizeValues(clues, round) {
  const rawValues = clues.map(c => c.dollar_value).sort((a, b) => a - b)

  // For modern values: use as-is if they match
  const isModernJ = rawValues.every(v => VALID_J_VALUES.has(v))
  const isModernDJ = rawValues.every(v => VALID_DJ_VALUES.has(v))

  if (isModernJ || isModernDJ) {
    return clues.sort((a, b) => a.dollar_value - b.dollar_value)
  }

  // For older/irregular values, map to modern scale by rank order
  // Only if they're increasing and all distinct
  const sorted = [...rawValues].sort((a, b) => a - b)
  if (new Set(sorted).size !== 5) return null

  const isDoubleRound = round === 'Double Jeopardy!'
  const modernScale = isDoubleRound
    ? [400, 800, 1200, 1600, 2000]
    : [200, 400, 600, 800, 1000]

  const valueMap = new Map(sorted.map((v, i) => [v, modernScale[i]]))

  return clues
    .map(c => ({ ...c, dollar_value: valueMap.get(c.dollar_value) }))
    .sort((a, b) => a.dollar_value - b.dollar_value)
}

async function downloadTsv() {
  console.log(`Downloading TSV from ${TSV_URL} …`)
  const response = await fetch(TSV_URL)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

// Actual columns: round, clue_value, daily_double_value, category, comments, answer, question, air_date, notes
// Note: "answer" = clue text read by host; "question" = correct response said by contestant
function parseTsv(raw) {
  const lines = raw.split('\n')
  const header = lines[0].split('\t').map(h => h.trim())

  const colIdx = {}
  header.forEach((h, i) => { colIdx[h] = i })

  const required = ['air_date', 'round', 'category', 'clue_value', 'answer', 'question']
  for (const col of required) {
    if (!(col in colIdx)) throw new Error(`Missing expected column: ${col}`)
  }

  const ROUND_NAMES = { '1': 'Jeopardy!', '2': 'Double Jeopardy!', '3': 'Final Jeopardy!' }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const cols = line.split('\t')
    const roundNum = cols[colIdx['round']]?.trim()
    rows.push({
      air_date: cols[colIdx['air_date']]?.trim(),
      round: ROUND_NAMES[roundNum] ?? roundNum,
      category: cols[colIdx['category']]?.trim(),
      value: cols[colIdx['clue_value']]?.trim(),
      question: cols[colIdx['answer']]?.trim(),   // clue text
      answer: cols[colIdx['question']]?.trim(),    // correct response
    })
  }
  return rows
}

function groupIntoCategories(rows) {
  const groups = new Map()

  for (const row of rows) {
    if (!row.category || !row.question || !row.answer) continue
    if (row.round === 'Final Jeopardy!' || row.round === 'Tiebreaker') continue
    if (isGameMechanic(row.category)) continue

    // air_date is unique per episode; group by air_date + round + category
    const key = `${row.air_date}|||${row.round}|||${row.category}`
    if (!groups.has(key)) {
      groups.set(key, {
        name: row.category,
        round: row.round,
        air_date: row.air_date,
        clues: [],
      })
    }

    const dollarValue = parseDollarValue(row.value)
    groups.get(key).clues.push({
      clue_text: stripHtml(row.question),    // "answer" col = what host reads
      response_text: stripHtml(row.answer),   // "question" col = correct response
      dollar_value: dollarValue,
    })
  }

  return [...groups.values()]
}

// Collects Final Jeopardy! rows — one clue per episode, no dollar value.
function groupFinalJeopardy(rows) {
  const mediaCue = /\[.*?\]|\(.*?audio.*?\)|\(.*?video.*?\)|\(.*?visual.*?\)/i
  const groups = new Map()

  for (const row of rows) {
    if (row.round !== 'Final Jeopardy!') continue
    if (!row.category || !row.question || !row.answer) continue
    if (isGameMechanic(row.category)) continue
    if (mediaCue.test(row.question)) continue

    const clueText = stripHtml(row.question)
    const responseText = stripHtml(row.answer)
    if (!clueText || !responseText) continue

    const key = `${row.air_date}|||${row.category}`
    if (!groups.has(key)) {
      groups.set(key, {
        name: row.category,
        round: 'Final Jeopardy!',
        air_date: row.air_date,
        clue_text: clueText,
        response_text: responseText,
      })
    }
  }

  return [...groups.values()]
}

async function main() {
  // Load TSV
  let raw
  if (LOCAL_FILE) {
    console.log(`Reading local file: ${LOCAL_FILE}`)
    raw = await fs.readFile(LOCAL_FILE, 'utf8')
  } else {
    raw = await downloadTsv()
  }

  console.log('Parsing TSV …')
  const rows = parseTsv(raw)
  console.log(`  ${rows.length.toLocaleString()} rows parsed`)

  console.log('Grouping into category-sets …')
  const groups = groupIntoCategories(rows)
  console.log(`  ${groups.length.toLocaleString()} raw groups`)

  // Validate and normalize
  const valid = []
  let skippedCount = 0
  for (const group of groups) {
    if (!isValidClueSet(group.clues)) {
      skippedCount++
      continue
    }
    const normalized = normalizeValues(group.clues, group.round)
    if (!normalized) {
      skippedCount++
      continue
    }
    valid.push({ ...group, clues: normalized })
  }
  console.log(`  ${valid.length.toLocaleString()} valid, ${skippedCount.toLocaleString()} skipped`)

  // Tag with topic area and bucket by topic
  const byTopicRaw = new Map()
  for (const group of valid) {
    const topic = tagTopicArea(group.name)
    if (!byTopicRaw.has(topic)) byTopicRaw.set(topic, [])
    byTopicRaw.get(topic).push({
      name: group.name,
      topic_area: topic,
      season: deriveSeasonFromAirDate(group.air_date),
      air_date: group.air_date,
      round: group.round,
      clues: group.clues,
    })
  }

  // Shuffle each topic bucket and cap to MAX_PER_TOPIC for DB size management
  const byTopic = new Map()
  for (const [topic, sets] of byTopicRaw) {
    const shuffled = sets.sort(() => Math.random() - 0.5).slice(0, MAX_PER_TOPIC)
    byTopic.set(topic, shuffled)
  }

  // Report
  const totalCapped = [...byTopic.values()].reduce((sum, sets) => sum + sets.length, 0)
  console.log('\nTopic area summary (after capping at ' + MAX_PER_TOPIC + '/topic):')
  const sorted = [...byTopic.entries()].sort((a, b) => b[1].length - a[1].length)
  for (const [topic, sets] of sorted) {
    console.log(`  ${topic.padEnd(16)} ${sets.length.toLocaleString()} category-sets`)
  }
  console.log(`\n  Total: ${totalCapped.toLocaleString()} category-sets (${(totalCapped * 5).toLocaleString()} clues) across ${byTopic.size} topics`)

  if (DRY_RUN) {
    console.log('\n(dry run — no files written)')
    return
  }

  // Collect and export Final Jeopardy clues
  console.log('\nCollecting Final Jeopardy! clues …')
  const finalJeopardyGroups = groupFinalJeopardy(rows)
  const shuffledFJ = finalJeopardyGroups.sort(() => Math.random() - 0.5).slice(0, 2000)
  console.log(`  ${shuffledFJ.length.toLocaleString()} Final Jeopardy! clues`)

  // Write output files
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  for (const [topic, sets] of byTopic) {
    const outPath = path.join(OUTPUT_DIR, `${topic}.json`)
    await fs.writeFile(outPath, JSON.stringify(sets, null, 2), 'utf8')
  }

  const fjPath = path.join(OUTPUT_DIR, 'final_jeopardy.json')
  await fs.writeFile(fjPath, JSON.stringify(shuffledFJ, null, 2), 'utf8')

  console.log(`\n✓ Wrote ${byTopic.size} topic files + final_jeopardy.json to ${OUTPUT_DIR}`)
  console.log('Next step: rm backend/data/app.db && npm run dev --prefix backend')
}

// Season 1 premiered September 1984; new seasons start each September
function deriveSeasonFromAirDate(airDate) {
  if (!airDate) return null
  const [yearStr, monthStr] = airDate.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  if (isNaN(year)) return null
  // Season starts in September; if before September, still last season's number
  return month >= 9 ? year - 1983 : year - 1984
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
