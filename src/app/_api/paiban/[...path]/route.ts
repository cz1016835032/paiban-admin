import { NextRequest, NextResponse } from 'next/server';

const GAME_ADMIN_SERVER = process.env.GAME_ADMIN_SERVER_URL || 'http://127.0.0.1:8082';

// 从 Cookie 字符串中提取指定名称的 cookie 值
function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

async function proxyRequest(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join('/');
  const url = new URL(req.url);
  const targetUrl = `${GAME_ADMIN_SERVER}/paiban/${path}${url.search}`;

  // 构建转发的 headers
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    // 过滤掉 host 头，避免转发给后端时出现问题
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value);
    }
  });

  // 如果请求中已有 satoken header（paiban-admin 前端显式传入），直接使用
  // 否则退回到从 duodian-token / dev-duodian-token cookie 中读取（生产环境跨子域）
  if (!headers.get('satoken')) {
    const cookieHeader = req.headers.get('cookie');
    const duodianToken = getCookieValue(cookieHeader, 'duodian-token')
      || getCookieValue(cookieHeader, 'dev-duodian-token');
    if (duodianToken) {
      headers.set('satoken', duodianToken);
    }
  }

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined;

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    // @ts-expect-error Node.js fetch supports duplex
    duplex: 'half',
  });

  const resHeaders = new Headers(upstream.headers);
  // 移除可能影响 Next.js 的 content-encoding，因为 fetch 已自动解压
  resHeaders.delete('content-encoding');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await params);
}
