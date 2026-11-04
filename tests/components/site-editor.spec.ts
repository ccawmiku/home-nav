import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { emptyDashboard, validateDashboard, type Dashboard } from '../../shared/dashboard'
import App from '../../src/App.vue'

vi.mock('grid-layout-plus', () => ({
  GridLayout: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  GridItem: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
}))
vi.mock('../../src/IconPicker.vue', () => ({ __esModule: true, default: defineComponent({
  emits: ['select'], setup: (_, { emit }) => () => h('button', { type: 'button', 'aria-label': '选择 Server 图标', onClick: () => emit('select', 'Server') }, 'Server'),
}) }))

let stored: Dashboard, revision: number, puts: number, wrapper: VueWrapper | undefined
let metadataReply: () => Promise<Response>, failSave: boolean
const website = () => stored.sections.find(section => section.type === 'websites')!
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

beforeEach(() => {
  stored = emptyDashboard(); revision = 1; puts = 0; failSave = false
  website().sites = [
    { id: 'nas', name: 'NAS', url: 'https://nas.example.com/', icon: { type: 'auto', value: 'https://example.com/old.png' } },
    { id: 'router', name: '路由器', url: 'http://192.168.1.1/', icon: { type: 'lucide', value: 'Router', color: '#007aff' } },
  ]
  metadataReply = async () => Response.json({ name: '远端标题', icon: 'https://example.com/automatic.png' })
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit = {}) => {
    if (url === '/api/bootstrap') return Response.json({ authenticated: true, sitekey: '' })
    if (url.startsWith('/api/account-usage')) return Response.json({ status: 'unconfigured', scope: 'account', metrics: [], fetchedAt: null })
    if (url === '/api/metadata') return metadataReply()
    if (url === '/api/dashboard' && options.method === 'PUT') {
      puts++
      if (failSave) { failSave = false; return Response.json({ error: '其他设备已修改配置，请重新加载后再编辑' }, { status: 409 }) }
      const input = JSON.parse(options.body as string)
      expect(input.revision).toBe(revision)
      stored = clone(validateDashboard(input.dashboard)); revision++
      return Response.json({ revision })
    }
    if (url === '/api/dashboard') return Response.json({ dashboard: clone(stored), revision })
    throw Error('Unexpected test API: ' + url)
  }))
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; document.body.innerHTML = ''; vi.unstubAllGlobals() })

async function boot() {
  wrapper = mount(App, { attachTo: document.body, global: { stubs: { teleport: true, TurnstileWidget: true } } })
  await flushPromises()
  return wrapper
}
async function fromList() {
  await wrapper!.get('[aria-label="账户设置"]').trigger('click')
  await wrapper!.findAll('button').find(button => button.text() === '编辑网站')!.trigger('click')
  await wrapper!.get('.site-manager-row[aria-label="编辑 NAS"]').trigger('click')
}

describe('website editing', () => {
  it('edits name, URL and custom logo from the account list and retains all three after reloading', async () => {
    await boot(); await fromList()
    await wrapper!.get('input[placeholder="网站名称"]').setValue('家庭存储')
    await wrapper!.get('.url-field input').setValue('http://192.168.1.20:5000/')
    await wrapper!.get('input[placeholder="https://example.com/favicon.ico"]').setValue('https://example.com/new.png')
    await wrapper!.get('.site-form').trigger('submit'); await flushPromises()
    expect(puts).toBe(1)
    expect(website().sites[0]).toMatchObject({ id: 'nas', name: '家庭存储', url: 'http://192.168.1.20:5000/', icon: { type: 'auto', value: 'https://example.com/new.png' } })
    expect(website().sites[1]!.name).toBe('路由器')
    expect(wrapper!.find('.site-manager').exists()).toBe(true)
    wrapper!.unmount(); await boot()
    expect(wrapper!.get('.app-icon-link[title="家庭存储"]').attributes('href')).toBe('http://192.168.1.20:5000/')
    expect(wrapper!.get('.app-icon-link[title="家庭存储"] img').attributes('src')).toBe('https://example.com/new.png')
  })

  it('opens editing on right-click and saves a Lucide icon and color without adding a duplicate', async () => {
    await boot()
    await wrapper!.get('.app-icon-link[title="NAS"]').trigger('contextmenu')
    await wrapper!.findAll('.segmented button').find(button => button.text() === 'Lucide 图标')!.trigger('click')
    await flushPromises()
    await wrapper!.get('[aria-label="选择 Server 图标"]').trigger('click')
    await wrapper!.get('[aria-label="#af52de"]').trigger('click')
    await wrapper!.get('.site-form').trigger('submit'); await flushPromises()
    expect(website().sites).toHaveLength(2)
    expect(website().sites[0]!.icon).toEqual({ type: 'lucide', value: 'Server', color: '#af52de' })
  })

  it('preserves manual names and icon URLs when an older metadata request finishes', async () => {
    let resolve!: (response: Response) => void
    metadataReply = () => new Promise(done => { resolve = done })
    await boot(); await fromList()
    await wrapper!.get('[aria-label="获取网站图标并补全空白名称"]').trigger('click')
    await wrapper!.get('input[placeholder="网站名称"]').setValue('手动名称')
    await wrapper!.get('input[placeholder="https://example.com/favicon.ico"]').setValue('https://example.com/manual.png')
    resolve(Response.json({ name: '远端标题', icon: 'https://example.com/automatic.png' })); await flushPromises()
    expect((wrapper!.get('input[placeholder="网站名称"]').element as HTMLInputElement).value).toBe('手动名称')
    expect((wrapper!.get('input[placeholder="https://example.com/favicon.ico"]').element as HTMLInputElement).value).toBe('https://example.com/manual.png')
    await wrapper!.get('.site-form').trigger('submit'); await flushPromises()
    expect(website().sites[0]!.name).toBe('手动名称')
  })

  it.each([390, 1440])('exposes the edit button at %ipx and saves the draft on Done', async width => {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
    await boot(); await wrapper!.get('.customize-dashboard-button').trigger('click')
    await wrapper!.get('.shortcut-edit[aria-label="修改 NAS"]').trigger('click')
    await wrapper!.get('input[placeholder="网站名称"]').setValue('修改后的名称')
    expect(wrapper!.get('.site-form button[type="submit"]').text()).toBe('应用修改')
    await wrapper!.get('.site-form').trigger('submit'); await flushPromises()
    expect(puts).toBe(0)
    expect(wrapper!.get('.app-icon-link[title="修改后的名称"]').exists()).toBe(true)
    await wrapper!.get('.edit-done').trigger('click'); await flushPromises()
    expect(puts).toBe(1); expect(website().sites[0]!.name).toBe('修改后的名称')
  })

  it('keeps the form open after a failed save so editing can be retried', async () => {
    await boot(); await fromList(); failSave = true
    await wrapper!.get('input[placeholder="网站名称"]').setValue('重试后的名称')
    await wrapper!.get('.site-form').trigger('submit'); await flushPromises()
    expect(wrapper!.get('.site-form .form-error').text()).toContain('其他设备已修改配置')
    expect(website().sites[0]!.name).toBe('NAS')
    await wrapper!.get('.site-form').trigger('submit'); await flushPromises()
    expect(website().sites[0]!.name).toBe('重试后的名称')
  })
})
