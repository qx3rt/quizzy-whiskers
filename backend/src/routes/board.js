import express from 'express'
import { generateCuratedBoard, generateFinalJeopardy } from '../utils/boardGenerator.js'

const router = express.Router()

// GET /api/board
// Optional query params:
//   ?topics=shakespeare,mythology  (comma-separated topic slugs)
//   ?round=Jeopardy!              ('Jeopardy!' | 'Double Jeopardy!' — defaults to 'Jeopardy!')
// Returns 6 category-sets, each with 5 clues ordered by dollar value.
router.get('/', async (req, res) => {
  try {
    const topicsParam = req.query.topics
    const topicAreas = topicsParam
      ? topicsParam.split(',').map(t => t.trim()).filter(Boolean)
      : []

    const VALID_ROUNDS = ['Jeopardy!', 'Double Jeopardy!']
    const round = VALID_ROUNDS.includes(req.query.round) ? req.query.round : 'Jeopardy!'

    const board = await generateCuratedBoard(topicAreas, round)

    res.json({ success: true, data: board })
  } catch (error) {
    console.error('Error generating board:', error)
    res.status(500).json({ success: false, error: 'Failed to generate board' })
  }
})

// GET /api/board/final
// Returns a single random Final Jeopardy! category + clue.
router.get('/final', async (req, res) => {
  try {
    const result = await generateFinalJeopardy()
    if (!result) {
      return res.status(404).json({ success: false, error: 'No Final Jeopardy clues available' })
    }
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Error generating Final Jeopardy:', error)
    res.status(500).json({ success: false, error: 'Failed to generate Final Jeopardy' })
  }
})

export default router
