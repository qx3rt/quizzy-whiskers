import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../test/helpers.js'
import { runQuery } from '../db/database.js'

let app

beforeEach(async () => {
  app = await createTestApp()
  const topicSlugs = ['us-states', 'tv', 'science', 'biography']
  for (let i = 0; i < topicSlugs.length; i++) {
    const slug = topicSlugs[i]
    const result = await runQuery(
      'INSERT INTO category_groups (slug, display_name) VALUES ($1, $2) RETURNING id',
      [slug, slug]
    )
    const groupId = result.rows[0].id
    await runQuery(
      'INSERT INTO category_group_mappings (category_group_id, cluebase_category) VALUES ($1, $2)',
      [groupId, `TEST_CATEGORY_${slug.toUpperCase()}`]
    )
  }
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
