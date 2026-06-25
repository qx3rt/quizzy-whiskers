import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp, seedTestBoard } from '../test/helpers.js'

let app

beforeEach(async () => {
  app = await createTestApp()
  await seedTestBoard('Jeopardy!')
  await seedTestBoard('Double Jeopardy!')
})

describe('GET /api/board', () => {
  it('returns 6 columns each with 5 clues', async () => {
    const res = await request(app).get('/api/board')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const board = res.body.data
    expect(board).toHaveLength(6)
    for (const col of board) {
      expect(col.clues).toHaveLength(5)
      expect(col.category).toBeDefined()
    }
  })

  it('each clue has the expected shape', async () => {
    const res = await request(app).get('/api/board')
    const clue = res.body.data[0].clues[0]
    expect(clue).toHaveProperty('id')
    expect(clue).toHaveProperty('value')
    expect(clue).toHaveProperty('clue_text')
    expect(clue).toHaveProperty('response_text')
  })

  it('returns Double Jeopardy! clues capped at $2000', async () => {
    const res = await request(app).get('/api/board?round=Double+Jeopardy!')
    expect(res.status).toBe(200)
    for (const col of res.body.data) {
      for (const clue of col.clues) {
        expect(clue.value).toBeLessThanOrEqual(2000)
      }
    }
  })

  it('clues are ordered by dollar value ascending', async () => {
    const res = await request(app).get('/api/board')
    for (const col of res.body.data) {
      const values = col.clues.map(c => c.value)
      expect(values).toEqual([...values].sort((a, b) => a - b))
    }
  })
})

describe('GET /api/board/final', () => {
  it('returns a category and clue', async () => {
    const res = await request(app).get('/api/board/final')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('category')
    expect(res.body.data.clue).toHaveProperty('clue_text')
    expect(res.body.data.clue).toHaveProperty('response_text')
  })
})
