export type SiteIcon = { type: 'auto' | 'lucide'; value: string; color?: string }
export type Site = { id: string; name: string; url: string; icon: SiteIcon }
export type WebsiteSection = { id: string; type: 'websites'; x: number; y: number; w: number; h: number; hidden?: boolean; sites: Site[] }
export type Dashboard = { version: 1; sections: WebsiteSection[] }
export const emptyDashboard = (): Dashboard => ({ version: 1, sections: [{ id: 'websites', type: 'websites', x: 0, y: 0, w: 12, h: 1, sites: [] }] })

export function websiteUrl(value: string): string {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || value.length > 2048) throw new Error('请输入有效的 HTTP 或 HTTPS 网址')
  return url.href
}

export function validateDashboard(value: unknown): Dashboard {
  if (!value || typeof value !== 'object') throw new Error('无效的配置')
  const dashboard = value as Dashboard
  if (dashboard.version !== 1 || !Array.isArray(dashboard.sections) || dashboard.sections.length !== 1) throw new Error('无效的栏目配置')
  const ids = new Set<string>()
  for (const section of dashboard.sections) {
    if (!section || section.type !== 'websites' || typeof section.id !== 'string' || !/^[\w-]{1,80}$/.test(section.id)) throw new Error('无效的栏目')
    if (section.hidden !== undefined && typeof section.hidden !== 'boolean') throw new Error('无效的栏目状态')
    for (const key of ['x', 'y', 'w', 'h'] as const) if (!Number.isInteger(section[key]) || section[key] < 0 || section[key] > 10000) throw new Error('无效的布局')
    if (section.w < 1 || section.w > 12 || section.h < 1 || section.x + section.w > 12) throw new Error('无效的布局')
    if (!Array.isArray(section.sites) || section.sites.length > 200) throw new Error('最多添加 200 个网站')
    for (const site of section.sites) {
      if (!site || typeof site.id !== 'string' || !/^[\w-]{1,80}$/.test(site.id) || ids.has(site.id)) throw new Error('无效的网站标识')
      ids.add(site.id)
      if (typeof site.name !== 'string' || !site.name.trim() || site.name.length > 80) throw new Error('名称应为 1–80 个字符')
      if (typeof site.url !== 'string') throw new Error('无效的网址')
      websiteUrl(site.url)
      const icon = site.icon
      if (!icon || !['auto', 'lucide'].includes(icon.type) || typeof icon.value !== 'string') throw new Error('无效的图标')
      if (icon.type === 'lucide' && !/^[A-Za-z0-9]{1,80}$/.test(icon.value)) throw new Error('无效的图标名称')
      if (icon.type === 'auto' && icon.value) {
        if (icon.value.startsWith('data:')) {
          if (!/^data:image\/(?:png|jpeg|webp|gif|svg\+xml|x-icon|vnd.microsoft.icon);base64,[A-Za-z0-9+/=]+$/.test(icon.value) || icon.value.length > 130000) throw new Error('图标格式或大小无效')
        } else websiteUrl(icon.value)
      }
      if (icon.color && !/^#[0-9a-f]{6}$/i.test(icon.color)) throw new Error('无效的图标颜色')
    }
  }
  return dashboard
}
