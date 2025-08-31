/**
 * 基础代理类
 * 移植自SpectreProxy的BaseProxy核心功能
 */
export class BaseProxy {
  protected encoder: TextEncoder;
  protected decoder: TextDecoder;
  protected debugMode: boolean;

  constructor(debugMode: boolean = false) {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.debugMode = debugMode;
  }

  protected log(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[PrivacyProxy] ${message}`, data || '');
    }
  }

  /**
   * 过滤HTTP头，移除CF-*等隐私泄露头部
   * 移植自SpectreProxy src/proxies/base.js:123
   */
  protected filterHeaders(headers: Headers): Headers {
    // 过滤不应转发的HTTP头（忽略以下头部：host、accept-encoding、cf-*、cdn-*、referer、referrer）
    const HEADER_FILTER_RE = /^(host|accept-encoding|cf-|cdn-|referer|referrer)/i;
    const cleanedHeaders = new Headers();
    
    for (const [k, v] of headers) {
      if (!HEADER_FILTER_RE.test(k)) {
        cleanedHeaders.set(k, v);
      }
    }
    
    return cleanedHeaders;
  }

  /**
   * 检查是否为Cloudflare网络限制错误
   * 移植自SpectreProxy src/proxies/base.js:78
   */
  protected isCloudflareNetworkError(error: any): boolean {
    const errorMessage = error?.message || '';
    return (
      errorMessage.includes('Cloudflare') ||
      errorMessage.includes('cf-') ||
      errorMessage.includes('restricted') ||
      errorMessage.includes('blocked')
    );
  }

  /**
   * 从socket读取直到遇到双CRLF（HTTP响应结束）
   */
  protected async readUntilDoubleCRLF(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    let buffer = '';
    const crlf = '\r\n';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += this.decoder.decode(value, { stream: true });
      
      if (buffer.includes(crlf + crlf)) {
        break;
      }
    }
    
    return buffer;
  }

  /**
   * 解析HTTP响应
   */
  protected async parseResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Response> {
    const responseText = await this.readUntilDoubleCRLF(reader);
    const [statusLine, ...headerLines] = responseText.split('\r\n');
    
    // 解析状态行
    const statusMatch = statusLine.match(/^HTTP\/1\.1 (\d+) (.+)$/);
    if (!statusMatch) {
      throw new Error('Invalid HTTP response');
    }
    
    const status = parseInt(statusMatch[1]);
    
    // 解析头部
    const headers = new Headers();
    for (const line of headerLines) {
      if (line.trim() === '') continue;
      const [key, value] = line.split(': ', 2);
      if (key && value) {
        headers.set(key, value);
      }
    }
    
    // 创建可读流用于响应体
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    
    // 在后台继续读取响应体
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
        await writer.close();
      } catch (error) {
        await writer.abort(error);
      }
    })();
    
    return new Response(readable, {
      status,
      headers
    });
  }

  /**
   * 错误处理方法
   */
  protected handleError(error: any, context: string, status: number = 500): Response {
    this.log(`${context} failed`, error.message);
    return new Response(`Error ${context.toLowerCase()}: ${error.message}`, { status });
  }
}