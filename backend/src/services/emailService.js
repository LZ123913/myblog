import nodemailer from 'nodemailer'
import { config } from '../config/index.js'
import { db } from '../../../database/scripts/init.js'

let transporter = null

function getTransporter() {
  if (!config.smtp.host || !config.smtp.user) {
    return null
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    })
  }
  return transporter
}

export async function sendEmail(to, subject, html, text) {
  const t = getTransporter()
  if (!t) {
    console.log(`[Email] SMTP not configured. Would send to ${to}:`)
    console.log(`  Subject: ${subject}`)
    console.log(`  Body: ${text || html}`)
    return { success: false, error: 'SMTP not configured' }
  }

  try {
    const info = await t.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
      text
    })
    return { success: true, messageId: info.messageId }
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message)
    return { success: false, error: err.message }
  }
}

export async function sendVerificationEmail(email, token) {
  const verifyUrl = `${config.clientUrl}/#/subscription-verify?token=${token}`
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1F4E79;">订阅验证</h2>
      <p>感谢您订阅拾光集博客！请点击下方链接验证您的邮箱：</p>
      <a href="${verifyUrl}" style="display: inline-block; padding: 10px 24px; background: #1F4E79; color: #fff; text-decoration: none; border-radius: 4px;">验证邮箱</a>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">如果您没有订阅，请忽略此邮件。</p>
      <p style="font-size: 12px;"><a href="${config.clientUrl}/#/subscription-unsubscribe?email=${encodeURIComponent(email)}" style="color: #999;">退订</a></p>
    </div>`
  const text = `感谢您订阅拾光集博客！\n\n请访问以下链接验证邮箱：${verifyUrl}\n\n如果您没有订阅，请忽略此邮件。\n\n退订：${config.clientUrl}/#/subscription-unsubscribe?email=${encodeURIComponent(email)}`
  return sendEmail(email, '【拾光集】请验证您的订阅邮箱', html, text)
}

export async function sendOtpEmail(email, code) {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1F4E79;">登录验证码</h2>
      <p>您的拾光集博客登录验证码为：</p>
      <p style="font-size: 32px; font-weight: bold; color: #1F4E79; letter-spacing: 8px;">${code}</p>
      <p style="color: #999; font-size: 12px;">验证码有效期为 10 分钟，请尽快使用。</p>
    </div>`
  const text = `您的拾光集博客登录验证码为：${code}\n\n验证码有效期为 10 分钟，请尽快使用。`
  return sendEmail(email, '【拾光集】登录验证码', html, text)
}

export async function sendResetEmail(email, token) {
  const resetUrl = `${config.clientUrl}/#/reset-password?token=${token}`
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1F4E79;">密码重置</h2>
      <p>您正在重置拾光集博客的密码，请点击下方链接设置新密码：</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 24px; background: #1F4E79; color: #fff; text-decoration: none; border-radius: 4px;">重置密码</a>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">此链接有效期为 1 天，请尽快使用。如果您没有请求重置密码，请忽略此邮件。</p>
    </div>`
  const text = `您正在重置拾光集博客的密码，请访问以下链接设置新密码：${resetUrl}\n\n此链接有效期为 1 天。`
  return sendEmail(email, '【拾光集】密码重置', html, text)
}

export async function sendArticleNotification(subscription, article, template) {
  const articleUrl = `${config.clientUrl}/#/article/${article.slug}`
  const unsubscribeUrl = `${config.clientUrl}/#/subscription-unsubscribe?email=${encodeURIComponent(subscription.email)}`

  const author = db.prepare(`
    SELECT a.name FROM authors a
    JOIN articles ar ON ar.author_id = a.id
    WHERE ar.id = ?
  `).get(article.id)

  const replacements = {
    '{{articleTitle}}': article.title,
    '{{articleSummary}}': article.summary || '',
    '{{articleUrl}}': articleUrl,
    '{{authorName}}': author?.name || '拾光集',
    '{{unsubscribeUrl}}': unsubscribeUrl
  }

  let subject = template.subject
  let html = template.html_body
  let text = template.text_body

  for (const [key, value] of Object.entries(replacements)) {
    subject = subject.replaceAll(key, value)
    html = html.replaceAll(key, value)
    text = text.replaceAll(key, value)
  }

  const result = await sendEmail(subscription.email, subject, html, text)

  db.prepare(`
    INSERT INTO email_send_logs (subscription_id, article_id, template_id, status, error_message)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    subscription.id,
    article.id,
    template.id,
    result.success ? 'sent' : 'failed',
    result.error || ''
  )

  return result
}

export function getEnabledTemplate() {
  return db.prepare('SELECT * FROM email_templates WHERE status = ? LIMIT 1').get('enabled')
}

export async function sendArticleNotifications(article) {
  const template = getEnabledTemplate()
  if (!template) {
    console.log('[Email] No enabled template, skipping notifications')
    return { sent: 0, failed: 0 }
  }

  const subscribers = db.prepare('SELECT * FROM subscriptions WHERE is_verified = 1').all()
  let sent = 0
  let failed = 0

  for (const sub of subscribers) {
    const result = await sendArticleNotification(sub, article, template)
    if (result.success) sent++
    else failed++
  }

  console.log(`[Email] Article notification: ${sent} sent, ${failed} failed`)
  return { sent, failed }
}
