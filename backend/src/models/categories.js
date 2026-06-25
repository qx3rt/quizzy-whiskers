import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getAllQuery, runQuery } from '../db/database.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JARCHIVE_DIR = join(__dirname, '../../data/jarchive')

// Topic groups with display names — used to seed category_groups table.
const TOPIC_GROUPS = [
  { slug: 'shakespeare',  display: 'Shakespeare' },
  { slug: 'dickens',      display: 'Dickens' },
  { slug: 'twain',        display: 'Mark Twain' },
  { slug: 'austen',       display: 'Jane Austen' },
  { slug: 'hemingway',    display: 'Hemingway' },
  { slug: 'poe',          display: 'Edgar Allan Poe' },
  { slug: 'poetry',       display: 'Poetry' },
  { slug: 'literature',   display: 'Literature' },
  { slug: 'broadway',     display: 'Broadway' },
  { slug: 'opera',        display: 'Opera' },
  { slug: 'ballet',       display: 'Ballet' },
  { slug: 'classical',    display: 'Classical Music' },
  { slug: 'movies',       display: 'Movies' },
  { slug: 'television',   display: 'Television' },
  { slug: 'disney',       display: 'Disney' },
  { slug: 'music',        display: 'Music' },
  { slug: 'art',          display: 'Art' },
  { slug: 'architecture', display: 'Architecture' },
  { slug: 'presidents',   display: 'Presidents' },
  { slug: 'royalty',      display: 'Royalty' },
  { slug: 'war',          display: 'War & Military' },
  { slug: 'history',      display: 'History' },
  { slug: 'politics',     display: 'Politics' },
  { slug: 'mythology',    display: 'Mythology' },
  { slug: 'bible',        display: 'The Bible' },
  { slug: 'religion',     display: 'Religion' },
  { slug: 'philosophy',   display: 'Philosophy' },
  { slug: 'astronomy',    display: 'Astronomy' },
  { slug: 'biology',      display: 'Biology' },
  { slug: 'chemistry',    display: 'Chemistry' },
  { slug: 'physics',      display: 'Physics' },
  { slug: 'science',      display: 'Science' },
  { slug: 'medicine',     display: 'Medicine' },
  { slug: 'geography',    display: 'Geography' },
  { slug: 'capitals',     display: 'World Capitals' },
  { slug: 'countries',    display: 'Countries' },
  { slug: 'us-states',    display: 'U.S. States' },
  { slug: 'cities',       display: 'Cities' },
  { slug: 'baseball',     display: 'Baseball' },
  { slug: 'football',     display: 'Football' },
  { slug: 'basketball',   display: 'Basketball' },
  { slug: 'hockey',       display: 'Hockey' },
  { slug: 'soccer',       display: 'Soccer' },
  { slug: 'olympics',     display: 'Olympics' },
  { slug: 'golf',         display: 'Golf' },
  { slug: 'boxing',       display: 'Boxing' },
  { slug: 'tennis',       display: 'Tennis' },
  { slug: 'sports',       display: 'Sports' },
  { slug: 'food',         display: 'Food & Drink' },
  { slug: 'business',     display: 'Business' },
  { slug: 'technology',   display: 'Technology' },
  { slug: 'language',     display: 'Language & Words' },
  { slug: 'biography',    display: 'Biography' },
]

// Seeds category_groups and category_group_mappings from jarchive data. Safe to call on every startup.
export async function syncCategoryGroups() {
  try {
    // Upsert group rows (fast, idempotent)
    for (const group of TOPIC_GROUPS) {
      await runQuery(
        'INSERT INTO category_groups (slug, display_name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
        [group.slug, group.display]
      )
    }
    const [{ groupCount }] = await getAllQuery('SELECT COUNT(*)::int AS "groupCount" FROM category_groups')
    console.log(`[categories] category_groups: ${groupCount} rows`)

    const [{ mappingCount }] = await getAllQuery('SELECT COUNT(*)::int AS "mappingCount" FROM category_group_mappings')
    console.log(`[categories] category_group_mappings: ${mappingCount} rows`)
    if (mappingCount > 0) {
      console.log('[categories] mappings already populated, skipping rebuild')
      return
    }

    // Build mappings directly from jarchive JSON using the known topic_area on each category
    console.log('[categories] Building category_group_mappings from jarchive topic areas...')
    const groups = await getAllQuery('SELECT id, slug FROM category_groups')
    const groupBySlug = Object.fromEntries(groups.map((g) => [g.slug, g.id]))

    const files = readdirSync(JARCHIVE_DIR).filter(
      (f) => f.endsWith('.json') && f !== 'final_jeopardy.json'
    )

    let mapped = 0
    const seen = new Set()
    for (const file of files) {
      const categories = JSON.parse(readFileSync(join(JARCHIVE_DIR, file), 'utf8'))
      for (const cat of categories) {
        if (!cat.topic_area || !cat.name || seen.has(cat.name)) continue
        seen.add(cat.name)
        const groupId = groupBySlug[cat.topic_area]
        if (!groupId) continue
        await runQuery(
          'INSERT INTO category_group_mappings (category_group_id, cluebase_category) VALUES ($1, $2) ON CONFLICT (cluebase_category) DO NOTHING',
          [groupId, cat.name]
        )
        mapped++
      }
    }
    console.log(`[categories] Mapped ${mapped} categories from jarchive data`)
  } catch (err) {
    console.error('[categories] syncCategoryGroups failed:', err.message)
  }
}

// Returns topic areas with the count of jarchive categories mapped to each group.
export async function getTopicAreas() {
  return getAllQuery(`
    SELECT cg.slug AS id,
           cg.slug AS slug,
           COUNT(cgm.id)::int AS category_count
    FROM category_groups cg
    JOIN category_group_mappings cgm ON cgm.category_group_id = cg.id
    GROUP BY cg.slug
    ORDER BY cg.slug
  `)
}
