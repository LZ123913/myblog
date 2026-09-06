import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  devShowOtp: process.env.NODE_ENV !== 'production' && process.env.DEV_SHOW_OTP === 'true',
  jwtSecret: process.env.JWT_SECRET || 'shiguang-blog-secret',
  jwtExpiresIn: '7d',
  dbPath: process.env.DB_PATH || 'database/data/blog.db',
  contentDir: new URL('../../../content/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '465'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || ''
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'qwen',
    apiKey: process.env.AI_API_KEY || '',
    apiUrl: process.env.AI_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.AI_MODEL || 'qwen-plus'
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173'
}
