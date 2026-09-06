# 通义千问 API 集成实战：AI 摘要与内容润色

## 背景

在博客系统中集成 AI 能力，可以大幅提升内容创作效率和阅读体验。本文介绍如何接入通义千问 API 实现 AI 摘要和内容润色。

## API 接入

### 配置信息

```javascript
const config = {
  ai: {
    provider: 'qwen',
    apiKey: process.env.AI_API_KEY,
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus'
  }
}
```

### 调用封装

```javascript
async function callAi(prompt, systemPrompt, timeoutMs = 3000) {
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
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      }),
      signal: controller.signal
    })

    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timer)
  }
}
```

## 应用场景

### AI 摘要生成

为每篇文章自动生成不超过 200 字的摘要，方便读者快速了解内容。

### 内容润色

使用 AI 对原始笔记进行结构化润色，统一标题层级、优化语句表达。

### 标签推荐

根据文章内容智能推荐 3-5 个标签，优先从已有标签库中选择。

## 降级策略

当 AI 服务不可用时，系统需要有合理的降级方案：

- 摘要：截取文章前 100 字作为摘要
- 标签：基于关键词频率推荐本地标签
- 审核：默认放行评论

## 总结

通义千问 API 的接入非常简单，通过合理的封装和降级策略，可以在保证可用性的同时大幅提升博客系统的智能化水平。