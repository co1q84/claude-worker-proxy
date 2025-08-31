// 简单测试脚本验证隐私代理功能
// 运行: node test-privacy.js

// 模拟Cloudflare Workers环境
globalThis.fetch = async (url, options) => {
    console.log('Mock fetch called:', url)
    return new Response(JSON.stringify({ test: 'response' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    })
}

// 模拟cloudflare:sockets
const mockSocket = {
    writable: { getWriter: () => ({ write: async () => {}, close: async () => {} }) },
    readable: { getReader: () => ({ read: async () => ({ done: true }) }) },
    close: async () => {}
}

globalThis.connect = async () => mockSocket

// 导入测试模块
import('./src/privacy/privacy-proxy.js')
    .then(({ PrivacyProxy }) => {
        const proxy = new PrivacyProxy({
            ENABLE_PRIVACY_PROTECTION: 'true',
            DEBUG_MODE: 'true'
        })

        const testRequest = new Request('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer test-key'
            },
            body: JSON.stringify({ message: 'test' })
        })

        console.log('Testing PrivacyProxy...')

        proxy
            .fetch(testRequest)
            .then(response => {
                console.log('✅ PrivacyProxy test passed')
                console.log('Response status:', response.status)
            })
            .catch(error => {
                console.log('❌ PrivacyProxy test failed:', error.message)
            })
    })
    .catch(error => {
        console.log('❌ Module import failed:', error.message)
    })
