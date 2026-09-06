import { db } from '../../../database/scripts/init.js'
import { config } from '../config/index.js'
import { ApiError } from '../middleware/errorHandler.js'

function getAiConfig(scenario) {
  const row = db.prepare('SELECT * FROM ai_configs WHERE scenario = ? AND enabled = 1 ORDER BY version DESC LIMIT 1').get(scenario)
  return row
}

async function callAiOnce(prompt, systemPrompt, timeoutMs, model, apiKey, apiUrl) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      throw new ApiError('aiRequestFailed', `AI 请求失败: ${response.status}`, 500, true)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    return content
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('aiTimeout', 'AI 服务繁忙，请稍后重试', 504, true)
    }
    if (err instanceof ApiError) throw err
    throw new ApiError('aiError', `AI 调用异常: ${err.message}`, 500, true)
  } finally {
    clearTimeout(timer)
  }
}

async function callAi(prompt, systemPrompt, timeoutMs, model, aiConfig) {
  const apiKey = (aiConfig && aiConfig.api_key_encrypted) ? aiConfig.api_key_encrypted : config.ai.apiKey
  const apiUrl = (aiConfig && aiConfig.api_url) ? aiConfig.api_url : config.ai.apiUrl
  const useModel = model || (aiConfig && aiConfig.model) || config.ai.model

  if (!apiKey) {
    throw new ApiError('aiNotConfigured', 'AI 服务未配置，请在后台 AI 配置页面或 .env 文件中设置 API Key', 500, true)
  }

  try {
    return await callAiOnce(prompt, systemPrompt, timeoutMs, useModel, apiKey, apiUrl)
  } catch (err) {
    if (err.code === 'aiTimeout' || err.code === 'aiError') {
      await new Promise(r => setTimeout(r, 800))
      return await callAiOnce(prompt, systemPrompt, timeoutMs, useModel, apiKey, apiUrl)
    }
    throw err
  }
}

const POLISH_SYSTEM_PROMPT = `你是一位专业的技术博客编辑。请按照以下规则对文章进行润色：

1. 标题结构：建立清晰的 H1、H2、H3 层级，标题准确概括内容。
2. 语句优化：修正病句、重复表达和不自然措辞，保持原有技术含义。
3. 背景补充：为必要的技术概念补充适度背景和上下文，不虚构事实。
4. 代码规范：统一代码格式、命名和代码块语言标识，保留代码可运行性。
5. 图片占位：识别适合配图的位置，使用统一图片占位标记 ![图片描述](placeholder)，不伪造图片地址。
6. 列表优化：将并列内容整理为有序或无序列表，避免信息堆叠。
7. 强调标记：对关键结论、注意事项和重要术语使用适度强调标记。
8. 总结生成：在文末生成与正文一致的总结小节。
9. 输出限制：只输出结构化 Markdown，不输出思考过程、额外寒暄或无关内容。输出必须包含 frontmatter（含 title、date、tags 字段）、层级标题、代码块和总结小节。
10. 评论提交：保留并规范评论提交相关的交互说明、真人验证要求和用户反馈文案，不得删除该业务要求。`

export async function generateSummary(articleContent, articleTitle) {
  const aiConfig = getAiConfig('summary')
  const timeout = aiConfig?.timeout_ms || 3000
  const systemPrompt = aiConfig?.system_prompt || '请为以下技术博客文章生成一段简洁的摘要，不超过200字。'

  try {
    const result = await callAi(
      `文章标题：${articleTitle}\n\n文章内容：${articleContent}`,
      systemPrompt,
      timeout,
      aiConfig?.model,
      aiConfig
    )
    return result.trim()
  } catch (err) {
    if (err.code === 'aiTimeout' || err.code === 'aiNotConfigured' || err.code === 'aiError') {
      const fallback = articleContent.slice(0, 100)
      return fallback
    }
    throw err
  }
}

export async function polishContent(rawContent) {
  const aiConfig = getAiConfig('polish')
  const timeout = aiConfig?.timeout_ms || 10000
  const systemPrompt = aiConfig?.system_prompt || POLISH_SYSTEM_PROMPT

  const result = await callAi(rawContent, systemPrompt, timeout, aiConfig?.model, aiConfig)
  return result.trim()
}

export async function recommendTags(content, existingTags) {
  const aiConfig = getAiConfig('tag')
  const timeout = aiConfig?.timeout_ms || 3000
  const systemPrompt = (aiConfig?.system_prompt || '请从以下文章内容中推荐3-5个最合适的标签。') +
    `\n已有标签库：${existingTags.join(', ')}。请优先从标签库中选择，也可以推荐新标签。只返回标签名称，用逗号分隔。`

  try {
    const result = await callAi(content, systemPrompt, timeout, aiConfig?.model, aiConfig)
    const tags = result.split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    return tags
  } catch (err) {
    return localTagFallback(content, existingTags)
  }
}

function localTagFallback(content, existingTags) {
  const freq = {}
  for (const tag of existingTags) {
    const count = (content.match(new RegExp(tag, 'gi')) || []).length
    if (count > 0) freq[tag] = count
  }
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([tag]) => tag)
}

export async function moderateComment(commentContent) {
  const aiConfig = getAiConfig('comment')
  const timeout = aiConfig?.timeout_ms || 3000
  const systemPrompt = aiConfig?.system_prompt || '请判断以下评论是否为广告或灌水内容。只返回 true（是广告/灌水）或 false（正常评论）。'

  try {
    const result = await callAi(commentContent, systemPrompt, timeout, aiConfig?.model, aiConfig)
    const isSpam = result.toLowerCase().includes('true')
    return !isSpam
  } catch (err) {
    return true
  }
}

export async function testAiConnection(scenario, model, systemPrompt, userPrompt) {
  const aiConfig = getAiConfig(scenario)
  const timeout = aiConfig?.timeout_ms || 30000
  const result = await callAi(userPrompt || '测试连接', systemPrompt || '你好', timeout, model, aiConfig)
  return result
}
