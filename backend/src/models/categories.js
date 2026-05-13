import { getAllQuery, getQuery } from '../db/database.js'

// Returns topic areas with the count of available category-sets each.
// This is what the frontend picker displays.
export function getTopicAreas() {
  return getAllQuery(`
    SELECT topic_area AS id,
           topic_area AS slug,
           COUNT(*) AS category_count
    FROM categories
    WHERE topic_area IS NOT NULL
    GROUP BY topic_area
    ORDER BY topic_area
  `)
}

export function getAllCategories() {
  return getAllQuery(`
    SELECT id, name, slug, topic_area, season, air_date, round,
           (SELECT COUNT(*) FROM clues WHERE category_id = categories.id) AS clue_count
    FROM categories
    ORDER BY name
  `)
}

export function getCategoryById(id) {
  return getQuery('SELECT * FROM categories WHERE id = ?', [id])
}

export function getCategoryBySlug(slug) {
  return getQuery('SELECT * FROM categories WHERE slug = ?', [slug])
}
