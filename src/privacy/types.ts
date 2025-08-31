export interface PrivacyConfig {
    /** 是否启用隐私保护 */
    ENABLE_PRIVACY_PROTECTION: boolean

    /** SOCKS5代理API地址列表 */
    SOCKS5_API_URLS: string[]

    /** 是否启用User-Agent随机化 */
    ENABLE_USER_AGENT_RANDOMIZATION: boolean

    /** 是否允许回退到原生fetch */
    FALLBACK_TO_FETCH: boolean

    /** 调试模式 */
    DEBUG_MODE: boolean

    /** 主机策略配置 */
    HOST_STRATEGIES: Record<string, PrivacyStrategy>
}

export type PrivacyStrategy =
    | 'socket_only' // 仅使用Socket
    | 'socket_with_fallback' // Socket失败回退到fetch
    | 'socks5_only' // 仅使用SOCKS5
    | 'socket_with_socks5' // Socket失败回退到SOCKS5
    | 'direct' // 直接使用原生fetch（无隐私保护）
    | 'auto' // 自动选择最佳策略

export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
    ENABLE_PRIVACY_PROTECTION: true,
    SOCKS5_API_URLS: [
        'https://api1.example.com/socks5',
        'https://api2.example.com/socks5',
        'https://api3.example.com/socks5'
    ],
    ENABLE_USER_AGENT_RANDOMIZATION: true,
    FALLBACK_TO_FETCH: true,
    DEBUG_MODE: false,
    HOST_STRATEGIES: {
        'api.openai.com': 'socket_with_fallback',
        'generativelanguage.googleapis.com': 'socket_with_fallback',
        'api.anthropic.com': 'socket_with_fallback',
        'api.cohere.ai': 'socket_with_fallback',
        'gateway.ai.cloudflare.com': 'direct', // Cloudflare Gateway使用直接连接
        '*': 'socket_with_fallback' // 默认使用基本隐私保护
    }
}
