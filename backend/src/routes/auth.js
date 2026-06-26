import express from 'express'
import bcrypt from 'bcryptjs'
import { getAllQuery, getQuery, runQuery } from '../db/database.js'
import { requireAuth, signToken } from '../middleware/auth.js'

const router = express.Router()

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' })
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
  }

  const normalizedEmail = email.toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' })
  }

  try {
    const existing = await getAllQuery('SELECT id FROM users WHERE email = $1', [normalizedEmail])
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await runQuery(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, token_version',
      [normalizedEmail, passwordHash, displayName?.trim() || null]
    )
    const { id: userId, token_version } = result.rows[0]

    const token = signToken({ userId, email: normalizedEmail, token_version })
    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: userId, email: normalizedEmail, displayName: displayName?.trim() || null },
      },
    })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ success: false, error: 'Registration failed' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' })
  }

  const normalizedEmail = email.toLowerCase().trim()

  try {
    const users = await getAllQuery(
      'SELECT id, email, password_hash, display_name, token_version FROM users WHERE email = $1',
      [normalizedEmail]
    )
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    const user = users[0]
    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }

    const token = signToken({ userId: user.id, email: user.email, token_version: user.token_version })
    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, displayName: user.display_name },
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const users = await getAllQuery(
      'SELECT id, email, display_name, created_at FROM users WHERE id = $1',
      [req.user.userId]
    )
    if (!users.length) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    const user = users[0]
    res.json({
      success: true,
      data: { id: user.id, email: user.email, displayName: user.display_name, memberSince: user.created_at },
    })
  } catch (err) {
    console.error('Auth me error:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch user' })
  }
})

// POST /api/auth/signout-all — invalidates all existing tokens for this user
router.post('/signout-all', requireAuth, async (req, res) => {
  try {
    await runQuery(
      'UPDATE users SET token_version = token_version + 1 WHERE id = $1',
      [req.user.userId]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('Signout-all error:', err)
    res.status(500).json({ success: false, error: 'Failed to sign out all sessions' })
  }
})

export default router
