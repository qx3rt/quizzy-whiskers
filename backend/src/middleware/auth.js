import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'quizzy-whiskers-dev-secret'
const JWT_EXPIRY = '30d'

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}
