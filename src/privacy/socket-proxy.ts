import { connect } from 'cloudflare:sockets'
import { BaseProxy } from './base-proxy'

/**
 * Socket代理类
 * 使用Cloudflare Socket API构建原始HTTP请求，避免CF-*头部泄露
 * 移植自SpectreProxy src/proxies/socket.js核心功能
 */
export class SocketProxy extends BaseProxy {
    constructor(debugMode: boolean = false) {
        super(debugMode)
    }

    /**
     * 使用Socket连接HTTP目标服务器
     * 移植自SpectreProxy src/proxies/socket.js:116
     */
    async connectHttp(request: Request, targetUrl: string): Promise<Response> {
        const url = new URL(targetUrl)

        // 清理头部信息
        const cleanedHeaders = this.filterHeaders(request.headers)

        // 设置必需的头部
        cleanedHeaders.set('Host', url.hostname)
        cleanedHeaders.set('accept-encoding', 'identity')

        try {
            const port = url.protocol === 'https:' ? 443 : 80
            const socket = await connect(
                { hostname: url.hostname, port: Number(port) },
                { secureTransport: url.protocol === 'https:' ? 'on' : 'off', allowHalfOpen: false }
            )

            const writer = socket.writable.getWriter()

            // 构建请求行和头部
            const requestLine =
                `${request.method} ${url.pathname}${url.search} HTTP/1.1\r\n` +
                Array.from(cleanedHeaders.entries())
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\r\n') +
                '\r\n\r\n'

            this.log('Sending HTTP request via socket', requestLine)
            await writer.write(this.encoder.encode(requestLine))

            // 如果有请求体，将其转发到目标服务器
            if (request.body) {
                this.log('Forwarding request body')
                const reader = request.body.getReader()
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    await writer.write(value)
                }
            }

            // 解析并返回目标服务器的响应
            return await this.parseResponse(socket.readable.getReader())
        } catch (error) {
            return this.handleError(error, 'Socket connection')
        }
    }

    /**
     * 执行HTTP请求
     */
    async fetch(request: Request): Promise<Response> {
        try {
            return await this.connectHttp(request, request.url)
        } catch (error) {
            // 检查是否是Cloudflare网络限制错误
            if (this.isCloudflareNetworkError(error)) {
                this.log('Cloudflare network restriction detected')
                throw error // 抛出错误让上层处理回退
            }
            throw error
        }
    }
}
