import { connect } from 'cloudflare:sockets';
import { BaseProxy } from './base-proxy';

interface Socks5Config {
  socks5ApiUrls: string[];
  debugMode: boolean;
}

interface Socks5ProxyInfo {
  host: string;
  port: number;
  username?: string;
  password?: string;
  hasAuth: boolean;
}

/**
 * SOCKS5代理类
 * 移植自SpectreProxy AIGatewayWithSocks.js SOCKS5功能
 */
export class Socks5Proxy extends BaseProxy {
  private socks5ApiUrls: string[];

  constructor(config: Socks5Config) {
    super(config.debugMode);
    this.socks5ApiUrls = config.socks5ApiUrls;
  }

  /**
   * 从API获取SOCKS5代理
   * 移植自SpectreProxy AIGatewayWithSocks.js:109
   */
  private async parseSocks5Proxy(): Promise<Socks5ProxyInfo> {
    try {
      const randomApiUrl = this.socks5ApiUrls[Math.floor(Math.random() * this.socks5ApiUrls.length)];
      const response = await fetch(randomApiUrl, { method: 'GET' });
      
      if (!response.ok) {
        throw new Error(`获取 SOCKS5 代理失败: ${response.status}`);
      }
      
      const proxyData = await response.text();
      if (!proxyData || proxyData.trim() === '') {
        throw new Error('未获取到 SOCKS5 代理数据');
      }
      
      const proxyList = proxyData.trim().split('\n').filter(line => line.trim());
      if (proxyList.length === 0) {
        throw new Error('代理列表为空');
      }
      
      const selectedProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
      let proxyStr = selectedProxy.trim();
      let username: string | null = null;
      let password: string | null = null;
      let host: string | null = null;
      let port: number | null = null;
      
      if (proxyStr.startsWith('socks5://')) {
        proxyStr = proxyStr.substring(9);
      }
      
      if (proxyStr.includes('@')) {
        const [authPart, addressPart] = proxyStr.split('@');
        if (authPart) [username, password] = authPart.split(':');
        [host, port] = addressPart.split(':');
      } else {
        [host, port] = proxyStr.split(':');
      }
      
      port = parseInt(port || '');
      
      if (!host || !port || isNaN(port)) {
        throw new Error(`代理格式不完整: ${selectedProxy}`);
      }
      
      return { host, port, username, password, hasAuth: !!(username && password) };
    } catch (error) {
      this.log('解析 SOCKS5 代理失败:', error);
      throw error;
    }
  }

  /**
   * 执行SOCKS5握手
   * 移植自SpectreProxy AIGatewayWithSocks.js:138
   */
  private async performSocks5Handshake(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    writer: WritableStreamDefaultWriter<Uint8Array>,
    targetHost: string,
    targetPort: number,
    username?: string,
    password?: string
  ): Promise<void> {
    const hasAuth = !!(username && password);
    
    // 发送认证方法请求
    await writer.write(hasAuth ? new Uint8Array([0x05, 0x01, 0x02]) : new Uint8Array([0x05, 0x01, 0x00]));
    
    const authResult = await reader.read();
    if (authResult.done || authResult.value[0] !== 0x05) {
      throw new Error('SOCKS5 版本不匹配或响应错误');
    }
    
    const selectedMethod = authResult.value[1];
    if (hasAuth && selectedMethod !== 0x02) {
      throw new Error('SOCKS5 服务器不支持用户名密码认证');
    }
    if (!hasAuth && selectedMethod !== 0x00) {
      throw new Error('SOCKS5 服务器需要认证但未提供');
    }
    
    // 用户名密码认证
    if (hasAuth && username && password) {
      const usernameBytes = this.encoder.encode(username);
      const passwordBytes = this.encoder.encode(password);
      const authData = new Uint8Array(3 + usernameBytes.length + passwordBytes.length);
      
      authData.set([0x01, usernameBytes.length], 0);
      authData.set(usernameBytes, 2);
      authData.set([passwordBytes.length], 2 + usernameBytes.length);
      authData.set(passwordBytes, 3 + usernameBytes.length);
      
      await writer.write(authData);
      
      const authResponse = await reader.read();
      if (authResponse.done || authResponse.value[0] !== 0x01 || authResponse.value[1] !== 0x00) {
        throw new Error('SOCKS5 认证失败');
      }
    }
    
    // 发送连接请求
    const targetHostBytes = this.encoder.encode(targetHost);
    const connectRequest = new Uint8Array(7 + targetHostBytes.length);
    
    connectRequest.set([0x05, 0x01, 0x00, 0x03, targetHostBytes.length], 0);
    connectRequest.set(targetHostBytes, 5);
    connectRequest.set([(targetPort >> 8) & 0xff, targetPort & 0xff], 5 + targetHostBytes.length);
    
    await writer.write(connectRequest);
    
    const connectResponse = await reader.read();
    if (connectResponse.done || connectResponse.value[0] !== 0x05 || connectResponse.value[1] !== 0x00) {
      throw new Error('SOCKS5 连接失败');
    }
  }

  /**
   * 通过SOCKS5代理连接HTTP目标
   */
  async connectViaSocks5(request: Request, targetUrl: string): Promise<Response> {
    try {
      const proxyInfo = await this.parseSocks5Proxy();
      const url = new URL(targetUrl);
      
      // 连接到SOCKS5代理服务器
      const socket = await connect(
        { hostname: proxyInfo.host, port: proxyInfo.port },
        { secureTransport: 'off', allowHalfOpen: false }
      );
      
      const writer = socket.writable.getWriter();
      const reader = socket.readable.getReader();
      
      // 执行SOCKS5握手
      await this.performSocks5Handshake(
        reader,
        writer,
        url.hostname,
        url.protocol === 'https:' ? 443 : 80,
        proxyInfo.username,
        proxyInfo.password
      );
      
      // 清理头部信息
      const cleanedHeaders = this.filterHeaders(request.headers);
      cleanedHeaders.set("Host", url.hostname);
      cleanedHeaders.set("accept-encoding", "identity");
      
      // 构建HTTP请求
      const requestLine =
        `${request.method} ${url.pathname}${url.search} HTTP/1.1\r\n` +
        Array.from(cleanedHeaders.entries())
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n";
      
      this.log("Sending HTTP request via SOCKS5", requestLine);
      await writer.write(this.encoder.encode(requestLine));
      
      // 转发请求体
      if (request.body) {
        const bodyReader = request.body.getReader();
        while (true) {
          const { done, value } = await bodyReader.read();
          if (done) break;
          await writer.write(value);
        }
      }
      
      // 解析响应
      return await this.parseResponse(reader);
      
    } catch (error) {
      return this.handleError(error, "SOCKS5 connection");
    }
  }

  /**
   * 执行HTTP请求通过SOCKS5
   */
  async fetch(request: Request): Promise<Response> {
    return await this.connectViaSocks5(request, request.url);
  }
}