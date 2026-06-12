import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../test/helpers.js'
import { getDatabase } from '../db/database.js'

let app

beforeEach(async () => {
  app = await createTestApp()
  const db = getDatabase()
  const topicSlugs = ['us-states', 'tv', 'science', 'biography']
  topicSlugs.forEach((slug, i) => {
    db.run(
      "INSERT INTO categories (name, slug, topic_area, round) VALUES (?, ?, ?, 'Jeopardy!')",
      [`Category ${i}`, `cat-${slug}-${i}`, slug]
    )
  })
})

describe('GET /api/categories', () => {
  it('returns an array of topic areas', async () => {
    const res = await request(app).get('/api/categories')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('each topic has name, slug-derived id, and category_count', async () => {
    const res = await request(app).get('/api/categories')
    for (const topic of res.body.data) {
      expect(topic).toHaveProperty('name')
      expect(typeof topic.category_count).toBe('number')
    }
  })

  it('humanizes us-states to U.S. States', async () => {
    const res = await request(app).get('/api/categories')
    const names = res.body.data.map(t => t.name)
    expect(names).toContain('U.S. States')
  })

  it('humanizes tv to Television', async () => {
    const res = await request(app).get('/api/categories')
    const names = res.body.data.map(t => t.name)
    expect(names).toContain('Television')
  })
})
