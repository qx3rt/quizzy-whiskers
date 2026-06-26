import jwt from 'jsonwebtoken'
import { getQuery } from '../db/database.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set')
}
const JWT_EXPIRY = '7d'

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  let payload
  try {
    payload = jwt.verify(authHeader.slice(7), JWT_SECRET)
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }

  // Token versioning: reject tokens issued before a signout-all
  if (payload.token_version !== undefined) {
    try {
      const user = await getQuery('SELECT token_version FROM users WHERE id = $1', [payload.userId])
      if (!user || payload.token_version !== user.token_version) {
        return res.status(401).json({ success: false, error: 'Token has been revoked' })
      }
    } catch {
      return res.status(500).json({ success: false, error: 'Auth check failed' })
    }
  }

  req.user = payload
  next()
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}
