export function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)

  const safeMessage = sanitizeError(err)

  res.status(err.statusCode || 500).json({
    error: err.code || 'internalError',
    message: safeMessage,
    retryable: err.retryable !== false
  })
}

function sanitizeError(err) {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /api[-_]?key/i,
    /stack/i,
    /at\s+\(.*:\d+:\d+\)/g
  ]

  let msg = err.message || '服务器内部错误'

  for (const pattern of sensitivePatterns) {
    if (pattern.test(msg)) {
      msg = '请求处理失败，请稍后重试'
      break
    }
  }

  return msg
}

export class ApiError extends Error {
  constructor(code, message, statusCode = 400, retryable = true) {
    super(message)
    this.code = code
    this.statusCode = statusCode
    this.retryable = retryable
  }
}
