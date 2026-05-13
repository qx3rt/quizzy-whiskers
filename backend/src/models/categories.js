import { getAllQuery, getQuery, runQuery } from '../db/database.js';

export function getAllCategories() {
  return getAllQuery(`
    SELECT id, name, slug, description,
           (SELECT COUNT(*) FROM clues WHERE category_id = categories.id) as clue_count
    FROM categories
    ORDER BY name
  `);
}

export function getCategoryById(id) {
  return getQuery('SELECT * FROM categories WHERE id = ?', [id]);
}

export function getCategoryBySlug(slug) {
  return getQuery('SELECT * FROM categories WHERE slug = ?', [slug]);
}

export function createCategory(name, slug, description) {
  const result = runQuery(`
    INSERT INTO categories (name, slug, description)
    VALUES (?, ?, ?)
  `, [name, slug, description]);

  if (result.success) {
    return { id: Math.random(), name, slug, description };
  }
  return null;
}
