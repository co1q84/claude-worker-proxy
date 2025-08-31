import { PrivacyConfig, PrivacyStrategy, DEFAULT_PRIVACY_CONFIG } from './types'
import { SocketProxy } from './socket-proxy'
import { Socks5Proxy } from './socks5-proxy'

/**
 * 隐私代理管理器
 * 智能选择最佳代理策略，提供隐私保护
 */
export class PrivacyProxy {
    private config: PrivacyConfig
    private socketProxy: SocketProxy
    private socks5Proxy: Socks5Proxy

    constructor(env: any = {}) {
        this.config = this.parseConfigFromEnv(env)
        this.socketProxy = new SocketProxy(this.config.DEBUG_MODE)
        this.socks5Proxy = new Socks5Proxy({
            socks5ApiUrls: this.config.SOCKS5_API_URLS,
            debugMode: this.config.DEBUG_MODE
        })
    }

    /**
     * 从环境变量解析配置
     */
    private parseConfigFromEnv(env: any): PrivacyConfig {
        const config: PrivacyConfig = { ...DEFAULT_PRIVACY_CONFIG }

        if (env.ENABLE_PRIVACY_PROTECTION) {
            config.ENABLE_PRIVACY_PROTECTION = env.ENABLE_PRIVACY_PROTECTION === 'true'
        }

        if (env.SOCKS5_API_URLS) {
            try {
                config.SOCKS5_API_URLS = JSON.parse(env.SOCKS5_API_URLS)
            } catch {
                config.SOCKS5_API_URLS = env.SOCKS5_API_URLS.split(',').map((url: string) => url.trim())
            }
        }

        if (env.ENABLE_USER_AGENT_RANDOMIZATION) {
            config.ENABLE_USER_AGENT_RANDOMIZATION = env.ENABLE_USER_AGENT_RANDOMIZATION === 'true'
        }

        if (env.FALLBACK_TO_FETCH) {
            config.FALLBACK_TO_FETCH = env.FALLBACK_TO_FETCH === 'true'
        }

        if (env.DEBUG_MODE) {
            config.DEBUG_MODE = env.DEBUG_MODE === 'true'
        }

        if (env.HOST_STRATEGIES) {
            try {
                config.HOST_STRATEGIES = JSON.parse(env.HOST_STRATEGIES)
            } catch {
                // 保持默认策略
            }
        }

        return config
    }

    /**
     * 根据主机名获取代理策略
     */
    private getStrategyForHost(hostname: string): PrivacyStrategy {
        if (!this.config.ENABLE_PRIVACY_PROTECTION) {
            return 'direct'
        }

        // 精确匹配
        if (this.config.HOST_STRATEGIES[hostname]) {
            return this.config.HOST_STRATEGIES[hostname]
        }

        // 通配符匹配
        if (this.config.HOST_STRATEGIES['*']) {
            return this.config.HOST_STRATEGIES['*']
        }

        return 'direct'
    }

    /**
     * 随机化User-Agent
     */
    private randomizeUserAgent(headers: Headers): void {
        if (!this.config.ENABLE_USER_AGENT_RANDOMIZATION) {
            return
        }

        const userAgents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
        ]

        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)]
        headers.set('User-Agent', randomUA)
    }

    /**
     * 执行HTTP请求
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url)
        const strategy = this.getStrategyForHost(url.hostname)

        if (strategy === 'direct') {
            return await fetch(request)
        }

        // 克隆请求以便修改头部
        const clonedRequest = new Request(request)

        // 随机化User-Agent
        this.randomizeUserAgent(clonedRequest.headers)

        try {
            switch (strategy) {
                case 'socket_only':
                    return await this.socketProxy.fetch(clonedRequest)

                case 'socket_with_fallback':
                    try {
                        return await this.socketProxy.fetch(clonedRequest)
                    } catch (error) {
                        if (this.config.FALLBACK_TO_FETCH) {
                            return await fetch(clonedRequest)
                        }
                        throw error
                    }

                case 'socks5_only':
                    return await this.socks5Proxy.fetch(clonedRequest)

                case 'socket_with_socks5':
                    try {
                        return await this.socketProxy.fetch(clonedRequest)
                    } catch (error) {
                        return await this.socks5Proxy.fetch(clonedRequest)
                    }

                case 'auto':
                    // 自动选择：先尝试Socket，失败后尝试SOCKS5，最后回退到fetch
                    try {
                        return await this.socketProxy.fetch(clonedRequest)
                    } catch (error1) {
                        try {
                            return await this.socks5Proxy.fetch(clonedRequest)
                        } catch (error2) {
                            if (this.config.FALLBACK_TO_FETCH) {
                                return await fetch(clonedRequest)
                            }
                            throw error2
                        }
                    }

                default:
                    return await fetch(clonedRequest)
            }
        } catch (error) {
            if (this.config.DEBUG_MODE) {
                console.error('[PrivacyProxy] Fetch failed:', error)
            }
            throw error
        }
    }

    /**
     * 检查是否启用隐私保护
     */
    isEnabled(): boolean {
        return this.config.ENABLE_PRIVACY_PROTECTION
    }
}
