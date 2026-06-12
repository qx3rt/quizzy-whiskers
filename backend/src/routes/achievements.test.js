import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../test/helpers.js'

let app
let token

beforeEach(async () => {
  app = await createTestApp()
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'ach@example.com', password: 'password123' })
  token = res.body.data.token
})

describe('GET /api/achievements', () => {
  it('returns all 5 seeded achievements', async () => {
    const res = await request(app).get('/api/achievements')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(5)
  })

  it('each achievement has slug, name, description', async () => {
    const res = await request(app).get('/api/achievements')
    for (const ach of res.body.data) {
      expect(ach).toHaveProperty('slug')
      expect(ach).toHaveProperty('name')
      expect(ach).toHaveProperty('description')
    }
  })

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/api/achievements')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/achievements/mine', () => {
  it('returns an empty array when user has no achievements', async () => {
    const res = await request(app)
      .get('/api/achievements/mine')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('returns earned achievements after a game is saved', async () => {
    await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ finalScore: 1000, round1Correct: 0, round1Incorrect: 0, round1TimedOut: 0,
              round2Correct: 0, round2Incorrect: 0, round2TimedOut: 0, finalJeopardyCorrect: null })
    const res = await request(app)
      .get('/api/achievements/mine')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data[0]).toHaveProperty('earned_at')
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/achievements/mine')
    expect(res.status).toBe(401)
  })
})
