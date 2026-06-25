import express from 'express'
import { getTopicAreas } from '../models/categories.js'

const router = express.Router()

// Returns topic areas (e.g. shakespeare, mythology) with category-set counts.
// Frontend uses this to populate the category picker.
router.get('/', async (req, res) => {
  try {
    const topics = await getTopicAreas()

    const formatted = topics.map(t => ({
      id: t.id,
      name: humanizeTopicSlug(t.slug),
      category_count: t.category_count,
    }))

    res.json({ success: true, data: formatted })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch categories' })
  }
})

function humanizeTopicSlug(slug) {
  const overrides = {
    'us-states': 'U.S. States',
    'broadway': 'Broadway',
    'tv': 'Television',
    'biography': 'Biography',
  }
  if (overrides[slug]) return overrides[slug]
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default router
