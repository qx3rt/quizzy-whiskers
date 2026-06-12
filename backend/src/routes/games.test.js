import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../test/helpers.js'

let app
let token

const validGame = {
  finalScore: 4200,
  round1Correct: 3,
  round1Incorrect: 1,
  round1TimedOut: 1,
  round2Correct: 2,
  round2Incorrect: 2,
  round2TimedOut: 1,
  finalJeopardyCorrect: true,
  topics: ['science'],
}

beforeEach(async () => {
  app = await createTestApp()
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'gamer@example.com', password: 'password123' })
  token = res.body.data.token
})

describe('POST /api/games', () => {
  it('saves a game and returns newAchievements', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send(validGame)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.newAchievements)).toBe(true)
  })

  it('awards first_game achievement on first save', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send(validGame)
    const slugs = res.body.data.newAchievements.map(a => a.slug)
    expect(slugs).toContain('first_game')
  })

  it('awards high_roller for score >= 10000', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validGame, finalScore: 10000 })
    const slugs = res.body.data.newAchievements.map(a => a.slug)
    expect(slugs).toContain('high_roller')
  })

  it('returns 400 when finalScore is missing', async () => {
    const { finalScore: _, ...noScore } = validGame
    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send(noScore)
    expect(res.status).toBe(400)
  })

  it('returns 400 when a round stat is out of range', async () => {
    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validGame, round1Correct: 99 })
    expect(res.status).toBe(400)
  })

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/games')
      .send(validGame)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/games', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${token}`)
      .send(validGame)
  })

  it('returns game history with summary stats', async () => {
    const res = await request(app)
      .get('/api/games')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.totalGames).toBe(1)
    expect(typeof res.body.data.bestScore).toBe('number')
    expect(typeof res.body.data.avgScore).toBe('number')
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/games')
    expect(res.status).toBe(401)
  })
})
