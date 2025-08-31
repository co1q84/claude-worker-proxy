把各家（Gemini，OpenAI）的模型 API 转换成 Claude 格式提供服务

## 特性

- 🚀 一键部署到 Cloudflare Workers
- 🔄 兼容 Claude Code。配合 [One-Balance](https://github.com/glidea/one-balance) 低成本，0 费用使用 Claude Code
- 📡 支持流式和非流式响应
- 🛠️ 支持工具调用
- 🎯 零配置，开箱即用

## 快速部署

```bash
git clone https://github.com/glidea/claude-worker-proxy
cd claude-worker-proxy
npm install
wrangler login # 如果尚未安装：npm i -g wrangler@latest
npm run deploycf
```

## 使用方法

```bash
# 例子：以 Claude 格式请求 Gemini 后端
curl -X POST https://claude-worker-proxy.xxxx.workers.dev/gemini/https://generativelanguage.googleapis.com/v1beta/v1/messages \
  -H "x-api-key: YOUR_GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

### Provider配置说明

根据不同的场景和厂商，您可以选择合适的配置方式：

#### 🔗 基本配置参数

- **URL 格式**：`{worker_url}/{type}/{provider_base_url}/v1/messages`
- **type**: 目标厂商类型，目前支持 `gemini`, `openai`
- **provider_base_url**: 对应厂商的 API 基础地址
- **API Key**: 通过 `x-api-key` 或 `authorization` 头传递

#### 🎯 配置场景

本代理支持以下不同的使用场景：

### 1. 直接厂商API（标准配置）

#### OpenAI
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-worker-domain.workers.dev/openai/https://api.openai.com/v1",
    "ANTHROPIC_CUSTOM_HEADERS": "x-api-key: YOUR_OPENAI_API_KEY",
    "ANTHROPIC_MODEL": "gpt-4",
    "ANTHROPIC_SMALL_FAST_MODEL": "gpt-3.5-turbo"
  }
}
```

#### Gemini
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-worker-domain.workers.dev/gemini/https://generativelanguage.googleapis.com/v1beta",
    "ANTHROPIC_CUSTOM_HEADERS": "x-api-key: YOUR_GEMINI_API_KEY",
    "ANTHROPIC_MODEL": "gemini-1.5-pro",
    "ANTHROPIC_SMALL_FAST_MODEL": "gemini-1.5-flash"
  }
}
```

#### 其他兼容OpenAI格式的厂商 (如OpenRouter)
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-worker-domain.workers.dev/openai/https://openrouter.ai/api/v1",
    "ANTHROPIC_CUSTOM_HEADERS": "authorization: Bearer YOUR_OPENROUTER_API_KEY",
    "ANTHROPIC_MODEL": "anthropic/claude-3-sonnet",
    "ANTHROPIC_SMALL_FAST_MODEL": "anthropic/claude-3-haiku"
  }
}
```

### 2. Cloudflare AI Gateway代理（隐私增强）

#### 基本语法
```
ANTHROPIC_BASE_URL: "{worker_url}/{type}/https://gateway.ai.cloudflare.com/v1/{account_tag}/{gateway_name}/{actual_provider}"
```

#### 2.1 通过AI Gateway代理OpenAI
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-worker-domain.workers.dev/openai/https://gateway.ai.cloudflare.com/v1/1234567890abc/my-gateway/openai",
    "ANTHROPIC_CUSTOM_HEADERS": "authorization: Bearer YOUR_OPENAI_API_KEY",
    "ANTHROPIC_MODEL": "gpt-4",
    "ANTHROPIC_SMALL_FAST_MODEL": "gpt-3.5-turbo"
  }
}
```

#### 2.2 通过AI Gateway代理其他厂商
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-worker-domain.workers.dev/openai/https://gateway.ai.cloudflare.com/v1/1234567890abc/my-gateway/openrouter",
    "ANTHROPIC_CUSTOM_HEADERS": "authorization: Bearer YOUR_OPENROUTER_API_KEY",
    "ANTHROPIC_MODEL": "anthropic/claude-3-sonnet",
    "ANTHROPIC_SMALL_FAST_MODEL": "anthropic/claude-3-haiku"
  }
}
```

### 3. 多层代理配置（Cloudflare Workers + AI Gateway + 厂商）

对于你提到的复杂场景：

#### 示例配置
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-worker-domain.workers.dev/openai/https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_TAG/your-gateway/openrouter",
    "ANTHROPIC_CUSTOM_HEADERS": "authorization: Bearer YOUR_OPENROUTER_API_KEY",
    "ANTHROPIC_MODEL": "anthropic/claude-3-5-sonnet-20241022",
    "ANTHROPIC_SMALL_FAST_MODEL": "anthropic/claude-3-haiku"
  }
}
```

#### 多层代理说明
这种配置的工作流是：
```
Claude Code → Claude Worker Proxy → Cloudflare AI Gateway → OpenRouter → 目标厂商
```

优势：
- ✅ **隐私保护**：AI Gateway隐藏原始IP，避免被追踪
- ✅ **请求监控**：能通过Cloudflare Dashboard监控使用情况
- ✅ **负载均衡**：AI Gateway提供自动负载均衡和重试机制
- ✅ **缓存优化**：相似请求可被缓存
- ✅ **成本控制**：通过AI Gateway设置使用限制

### 4. 企业内网/私有部署

如果厂商API部署在私有网络中，配置类似：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-worker-domain.workers.dev/openai/https://your-internal-api.company.com/v1",
    "ANTHROPIC_CUSTOM_HEADERS": "authorization: Bearer YOUR_PRIVATE_API_KEY",
    "ANTHROPIC_MODEL": "custom-model-name"
  }
}
```

### 配置建议

#### 🔐 安全注意事项
1. **API Key保护**：
   - 生产环境建议使用环境变量而非硬编码
   - 定期轮换API Key
   - 使用最小权限原则

2. **Cloudflare AI Gateway设置**：
   - 设置合理的速率限制
   - 启用日志记录但避免记录敏感信息
   - 配置缓存策略优化性能

#### 📊 性能优化
- **超时设置**：根据网络情况调整 `API_TIMEOUT_MS`
- **并发限制**：设置合适的max_tokens避免请求过大
- **模型选择**：根据使用场景选择合适的模型大小

#### 🐛 故障排除
- 检查API Key有效性
- 验证URL格式正确性
- 查看Cloudflare Workers日志
- 确保模型名称正确（大小写敏感）

### 快速开始 - Claude Code配置

#### 标准使用流程

1. **获取代理域名**：部署后获得类似 `https://your-worker-domain.workers.dev` 的域名

2. **编辑Claude配置**：
   ```bash
   mkdir -p ~/.claude
   # 编辑配置根据您的实际使用场景选择适当的配置
   ```

3. **启动使用**：
   ```bash
   claude
   ```

#### 推荐配置

**对于Cloudflare AI Gateway + OpenRouter多层代理，建议配置如下：**
```bash
# ~/.claude/settings.json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-worker-domain.workers.dev/openai/https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_TAG/your-gateway/openrouter",
    "ANTHROPIC_CUSTOM_HEADERS": "authorization: Bearer YOUR_OPENROUTER_API_KEY",
    "ANTHROPIC_MODEL": "anthropic/claude-3-5-sonnet-20241022",
    "ANTHROPIC_SMALL_FAST_MODEL": "anthropic/claude-3-haiku",
    "API_TIMEOUT_MS": "600000"
  }
}
```

#### 特别说明

- **隐私保护**：使用Cloudflare AI Gateway的配置可以隐藏原始IP
- **监控统计**：在Cloudflare Dashboard查看使用情况和性能指标
- **负载均衡**：自动处理请求分发和重试
- **缓存优化**：相同请求会使用缓存，提升性能

### 进阶配置

详见上面的 **Provider配置说明** 中的各种场景配置。

## 许可证

详情请查看 [LICENSE](LICENSE) 文件。
