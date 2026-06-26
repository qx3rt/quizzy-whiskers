import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { signToken, requireAuth } from './auth.js'

const SECRET = process.env.JWT_SECRET

describe('signToken', () => {
  it('produces a JWT with the given payload', () => {
    const token = signToken({ userId: 42, email: 'test@example.com' })
    const decoded = jwt.verify(token, SECRET)
    expect(decoded.userId).toBe(42)
    expect(decoded.email).toBe('test@example.com')
  })

  it('token expires in ~7 days', () => {
    const token = signToken({ userId: 1 })
    const decoded = jwt.decode(token)
    const sevenDaysFromNow = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    expect(decoded.exp).toBeGreaterThan(sevenDaysFromNow - 60)
    expect(decoded.exp).toBeLessThanOrEqual(sevenDaysFromNow + 60)
  })
})

describe('requireAuth', () => {
  function mockReqRes(authHeader) {
    const req = { headers: { authorization: authHeader } }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()
    return { req, res, next }
  }

  it('calls next() and sets req.user on a valid token', () => {
    const token = signToken({ userId: 7, email: 'a@b.com' })
    const { req, res, next } = mockReqRes(`Bearer ${token}`)
    requireAuth(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(req.user.userId).toBe(7)
  })

  it('returns 401 when Authorization header is missing', () => {
    const { req, res, next } = mockReqRes(undefined)
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when header does not start with Bearer', () => {
    const { req, res, next } = mockReqRes('Basic sometoken')
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for a malformed token', () => {
    const { req, res, next } = mockReqRes('Bearer not.a.real.token')
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for an expired token', () => {
    const expiredToken = jwt.sign({ userId: 1 }, SECRET, { expiresIn: -1 })
    const { req, res, next } = mockReqRes(`Bearer ${expiredToken}`)
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
