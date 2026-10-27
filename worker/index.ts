import { env } from 'cloudflare:workers'
import { emptyDashboard, validateDashboard, websiteUrl } from '../shared/dashboard'
import { hashPassword, sameSecret, signSession, verifySession } from './auth'

const json = (data: unknown, status = 200, headers: HeadersInit = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
const cookieName = '__Host-home-nav'
const getEpoch = async () => (await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('epoch').first<{ value: string }>())?.value || '0'
const isLocal = (request: Request) => ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname)
async function authenticated(request: Request): Promise<boolean> {
  const token = request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
  return !!token && verifySession(token, env.SESSION_SECRET, await getEpoch())
}
async function passwordMatches(password: string): Promise<boolean> {
  const saved = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('password').first<{ value: string }>()
  if (!saved) return sameSecret(password, env.ADMIN_PASSWORD)
  const { salt, hash } = JSON.parse(saved.value) as { salt: string; hash: string }
  return sameSecret(await hashPassword(password, salt), hash)
}
async function body(request: Request, limit = 1500000): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new Error('请求格式无效')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('请求为空')
  let size = 0; const chunks: Uint8Array[] = []
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new Error('请求过大') }; chunks.push(value) }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes))
}
async function login(request: Request): Promise<Response> {
  const input = await body(request, 6000) as { password?: string; token?: string }
  if (typeof input.password !== 'string' || input.password.length > 256 || typeof input.token !== 'string' || input.token.length > 2048) return json({ error: '请填写密码并完成验证' }, 400)
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  const now = Math.floor(Date.now() / 1000)
  const attemptKey = ip + ':' + Math.floor(now / 900)
  await env.DB.prepare('DELETE FROM login_attempts WHERE expires < ?').bind(now).run()
  const attempts = await env.DB.prepare('INSERT INTO login_attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(attemptKey, now + 900).first<{ count: number }>()
  if (!attempts || attempts.count > 10) return json({ error: '尝试过多，请稍后再试' }, 429)
  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: input.token, remoteip: isLocal(request) ? undefined : ip }), signal: AbortSignal.timeout(12000) })
  const challenge = await verify.json() as { success: boolean; hostname?: string; action?: string }
  if (!challenge.success || (!isLocal(request) && (challenge.hostname !== new URL(request.url).hostname || challenge.action !== 'login'))) return json({ error: '验证未通过，请重试' }, 403)
  if (!await passwordMatches(input.password)) return json({ error: '密码错误' }, 401)
  const token = await signSession(env.SESSION_SECRET, await getEpoch())
  return json({ ok: true }, 200, { 'Set-Cookie': `${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000` })
}
async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== url.origin) return json({ error: '请求来源无效' }, 403)
  if (url.pathname === '/api/bootstrap' && request.method === 'GET') return json({ authenticated: await authenticated(request), sitekey: env.TURNSTILE_SITE_KEY })
  if (url.pathname === '/api/login' && request.method === 'POST') return login(request)
  if (!await authenticated(request)) return json({ error: '请先登录' }, 401)
  if (url.pathname === '/api/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': `${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` })
  if (url.pathname === '/api/dashboard' && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT data,revision FROM dashboard WHERE id=1').first<{ data: string; revision: number }>()
    return json({ dashboard: row ? JSON.parse(row.data) : emptyDashboard(), revision: row?.revision || 0 })
  }
  if (url.pathname === '/api/dashboard' && request.method === 'PUT') {
    const input = await body(request) as { dashboard: unknown; revision: number }
    const dashboard = validateDashboard(input.dashboard)
    if (!Number.isInteger(input.revision) || input.revision < 0) throw new Error('无效的版本号')
    const saved = input.revision === 0
      ? await env.DB.prepare('INSERT OR IGNORE INTO dashboard(id,data,revision) VALUES(1,?,1)').bind(JSON.stringify(dashboard)).run()
      : await env.DB.prepare('UPDATE dashboard SET data=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND revision=?').bind(JSON.stringify(dashboard), input.revision).run()
    if (!saved.meta.changes) return json({ error: '其他设备已修改配置，请重新加载后再编辑' }, 409)
    return json({ revision: input.revision + 1 })
  }
  if (url.pathname === '/api/password' && request.method === 'POST') {
    const input = await body(request, 2000) as { current: string; password: string }
    if (typeof input.current !== 'string' || typeof input.password !== 'string' || input.current.length > 256 || input.password.length < 8 || input.password.length > 128) throw new Error('新密码应为 8–128 个字符')
    if (!await passwordMatches(input.current)) return json({ error: '当前密码错误' }, 400)
    const salt = crypto.randomUUID(); const hash = await hashPassword(input.password, salt)
    await env.DB.batch([
      env.DB.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').bind('password', JSON.stringify({ salt, hash })),
      env.DB.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').bind('epoch', crypto.randomUUID()),
    ])
    return json({ ok: true }, 200, { 'Set-Cookie': `${cookieName}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` })
  }
  if (url.pathname === '/api/metadata' && request.method === 'POST') {
    const input = await body(request, 3000) as { url: string }
    const target = new URL(websiteUrl(input.url))
    // Private services are discovered on the user's machine during import. Workers cannot reach a home LAN.
    if (target.protocol !== 'https:' || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(target.hostname) || /(?:^|\.)(?:localhost|local|internal|home|lan)$/i.test(target.hostname) || target.port && target.port !== '443') return json({ name: target.host, icon: '', local: true })
    let name = target.host; let icon = target.origin + '/favicon.ico'
    try {
      const response = await fetch(target.href, { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { Accept: 'text/html' } })
      if (response.ok && response.headers.get('Content-Type')?.includes('text/html')) {
        const reader = response.body?.getReader(); let html = ''
        if (reader) { const decoder = new TextDecoder(); let size = 0; while (size < 131072) { const result = await reader.read(); if (result.done) break; size += result.value.length; html += decoder.decode(result.value, { stream: true }) }; await reader.cancel() }
        name = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]?.trim().slice(0, 80) || name
        const links = html.match(/<link\b[^>]{1,1000}>/gi) || []
        const link = links.find(v => /rel\s*=\s*["'][^"']*\bicon\b/i.test(v))?.match(/href\s*=\s*["']([^"']+)["']/i)?.[1]
        if (link) { const parsed = new URL(link, target); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) icon = parsed.href }
      }
    } catch { /* A missing favicon or unreachable site should never block adding a shortcut. */ }
    return json({ name, icon })
  }
  return json({ error: '未找到接口' }, 404)
}
export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const response = await handle(request)
      const secured = new Response(response.body, response)
      secured.headers.set('X-Content-Type-Options', 'nosniff')
      secured.headers.set('Referrer-Policy', 'no-referrer')
      secured.headers.set('X-Frame-Options', 'DENY')
      secured.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
      return secured
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError || error instanceof Error && !('cause' in error) && /无效|名称|网址|图标|布局|密码|请求|最多|配置|栏目/.test(error.message)) return json({ error: error.message }, 400)
      console.error(JSON.stringify({ event: 'request_failed', path: new URL(request.url).pathname }))
      return json({ error: '暂时无法处理，请重试' }, 500)
    }
  },
} satisfies ExportedHandler
