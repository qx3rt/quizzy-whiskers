import express from 'express'
import { generateCuratedBoard } from '../utils/boardGenerator.js'

const router = express.Router()

// GET /api/board
// Optional query param: ?topics=shakespeare,mythology (comma-separated topic slugs)
// Returns 6 category-sets, each with 5 clues ordered by dollar value.
router.get('/', (req, res) => {
  try {
    const topicsParam = req.query.topics
    const topicAreas = topicsParam
      ? topicsParam.split(',').map(t => t.trim()).filter(Boolean)
      : []

    const board = generateCuratedBoard(topicAreas)

    res.json({ success: true, data: board })
  } catch (error) {
    console.error('Error generating board:', error)
    res.status(500).json({ success: false, error: 'Failed to generate board' })
  }
})

export default router
