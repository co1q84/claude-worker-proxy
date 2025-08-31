# 隐私保护功能使用指南

## 功能概述

为claude-worker-proxy添加了基于SpectreProxy的隐私保护功能，可以：

- ✅ 移除CF-\*等隐私泄露头部
- ✅ 使用Socket构建原始HTTP请求绕过地域限制
- ✅ 支持SOCKS5代理规避网络检测
- ✅ User-Agent随机化降低指纹识别
- ✅ 智能策略选择和回退机制

## 环境变量配置

### 启用隐私保护

```bash
ENABLE_PRIVACY_PROTECTION=true
```

### SOCKS5代理配置

```bash
# JSON数组格式
SOCKS5_API_URLS=["https://proxy1.com/socks5","https://proxy2.com/socks5"]

# 或逗号分隔格式
SOCKS5_API_URLS=https://proxy1.com/socks5,https://proxy2.com/socks5
```

### 高级配置

```bash
# User-Agent随机化
ENABLE_USER_AGENT_RANDOMIZATION=true

# 允许回退到原生fetch
FALLBACK_TO_FETCH=true

# 调试模式
DEBUG_MODE=true

# 主机策略配置 (JSON格式)
HOST_STRATEGIES={
  "api.openai.com": "socket_with_socks5",
  "generativelanguage.googleapis.com": "socket_with_fallback",
  "api.anthropic.com": "socket_with_socks5",
  "*": "direct"
}
```

## 策略说明

- `socket_only`: 仅使用Socket代理
- `socket_with_fallback`: Socket失败回退到fetch
- `socks5_only`: 仅使用SOCKS5代理
- `socket_with_socks5`: Socket失败回退到SOCKS5
- `direct`: 直接使用原生fetch（无隐私保护）
- `auto`: 自动选择最佳策略

## 部署说明

1. **默认行为**: 隐私保护默认禁用，完全向后兼容
2. **启用步骤**: 在Cloudflare Workers控制台设置环境变量
3. **测试建议**: 先启用DEBUG_MODE测试，确认正常后再投入生产

## 技术架构

```
用户请求 → API转换层 → 隐私代理层 → 目标API
                    ↓
             智能策略选择:
             - Socket代理 (移除CF-*头部)
             - SOCKS5代理 (规避地域限制)
             - 原生fetch (回退策略)
```

## 性能考虑

- Socket代理比原生fetch稍慢，但隐私保护更好
- SOCKS5代理有额外握手开销，建议仅对受限域名使用
- 可通过策略配置优化性能与隐私的平衡

## 故障排除

1. **Socket连接失败**: 检查目标API是否支持HTTP/1.1
2. **SOCKS5代理失败**: 检查代理API地址是否有效
3. **性能问题**: 调整HOST_STRATEGIES，对非关键域名使用direct策略
