<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { CirclePlus, WandSparkles, Check, Plus, LogOut, KeyRound, Download, Upload, LoaderCircle, GripVertical, Pencil, RotateCw } from '@lucide/vue'
import { GridItem, GridLayout } from 'grid-layout-plus'
import Draggable from 'vuedraggable'
import { emptyDashboard, validateDashboard, websiteUrl } from '../shared/dashboard'
import type { Dashboard, Site, WebsiteSection } from '../shared/dashboard'
import SiteIcon from './SiteIcon.vue'
import DialogShell from './DialogShell.vue'
import TurnstileWidget from './TurnstileWidget.vue'
const IconPicker = defineAsyncComponent(() => import('./IconPicker.vue'))
const dashboard = ref<Dashboard>(emptyDashboard()); const revision = ref(0)
const authenticated = ref(false); const loading = ref(true); const bootError = ref(''); const sitekey = ref('')
const password = ref(''); const token = ref(''); const loginError = ref(''); const busy = ref(false)
const turnstile = ref<InstanceType<typeof TurnstileWidget>>()
const editing = ref(false); let snapshot = ''
const accountOpen = ref(false); const modal = ref<'site' | 'password' | null>(null)
const notice = ref(''); let noticeTimer: ReturnType<typeof setTimeout> | undefined
const modalError = ref(''); const autoBusy = ref(false); const form = ref<Site>(newSite()); const originalId = ref('')
const currentPassword = ref(''); const nextPassword = ref(''); const repeatPassword = ref('')
const width = ref(window.innerWidth); const columns = computed(() => width.value < 760 ? 4 : 6)
const sections = computed(() => dashboard.value.sections.map(section => {
  const rows = Math.ceil(section.sites.length / columns.value)
  return { i: section.id, x: section.x, y: section.y, w: section.w, h: Math.max(315, columns.value === 4 ? rows * 90 + 40 : rows * 109 + Math.max(0, rows - 1) * 30 + 70) }
}))
const upload = ref<HTMLInputElement>(); const account = ref<HTMLElement>()
function newSite(): Site { return { id: crypto.randomUUID(), name: '', url: '', icon: { type: 'auto', value: '' } } }
function flash(message: string) { notice.value = message; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => notice.value = '', 5000) }
async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } })
  const data = await response.json() as T & { error?: string }
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/login') { authenticated.value = false; editing.value = false; modal.value = null; dashboard.value = emptyDashboard() }
    throw new Error(data.error || '请求失败，请重试')
  }
  return data
}
async function loadDashboard() {
  const result = await api<{ dashboard: Dashboard; revision: number }>('/api/dashboard')
  dashboard.value = validateDashboard(result.dashboard); revision.value = result.revision
}
async function boot() {
  loading.value = true; bootError.value = ''
  try { const result = await api<{ authenticated: boolean; sitekey: string }>('/api/bootstrap'); sitekey.value = result.sitekey; authenticated.value = result.authenticated; if (result.authenticated) await loadDashboard() }
  catch (error) { bootError.value = (error as Error).message }
  finally { loading.value = false }
}
async function login() {
  busy.value = true; loginError.value = ''
  try { await api('/api/login', { method: 'POST', body: JSON.stringify({ password: password.value, token: token.value }) }); password.value = ''; await loadDashboard(); authenticated.value = true }
  catch (error) { loginError.value = (error as Error).message; turnstile.value?.reset() }
  finally { busy.value = false }
}
async function save() {
  const result = await api<{ revision: number }>('/api/dashboard', { method: 'PUT', body: JSON.stringify({ dashboard: validateDashboard(dashboard.value), revision: revision.value }) })
  revision.value = result.revision
}
function customize() { snapshot = JSON.stringify(dashboard.value); editing.value = true; accountOpen.value = false }
async function finish() {
  busy.value = true
  try { await save(); editing.value = false; snapshot = ''; flash('已保存') } catch (error) { flash((error as Error).message) } finally { busy.value = false }
}
function cancel() { dashboard.value = JSON.parse(snapshot); editing.value = false; snapshot = '' }
function openSite(site?: Site) { if (busy.value) return; metadataGeneration++; originalId.value = site?.id || ''; form.value = site ? JSON.parse(JSON.stringify(site)) : newSite(); modalError.value = ''; autoBusy.value = false; accountOpen.value = false; modal.value = 'site' }
let metadataGeneration = 0
async function getMetadata() {
  const generation = ++metadataGeneration; const before = form.value.name
  try {
    const url = websiteUrl(form.value.url); autoBusy.value = true
    const result = await api<{ name: string; icon: string; local?: boolean }>('/api/metadata', { method: 'POST', body: JSON.stringify({ url }) })
    if (generation !== metadataGeneration || modal.value !== 'site') return
    if (form.value.name === before) form.value.name = result.name
    if (form.value.icon.type === 'auto') form.value.icon.value = result.icon
  } catch (error) { if (generation === metadataGeneration) modalError.value = (error as Error).message }
  finally { if (generation === metadataGeneration) autoBusy.value = false }
}
function closeModal() { if (busy.value) return; metadataGeneration++; modal.value = null; autoBusy.value = false }
async function submitSite() {
  busy.value = true; modalError.value = ''; const before = JSON.stringify(dashboard.value)
  try {
    const site: Site = JSON.parse(JSON.stringify(form.value)); site.name = site.name.trim(); site.url = websiteUrl(site.url)
    if (!site.name) site.name = new URL(site.url).host
    const list = dashboard.value.sections[0]!.sites; const index = list.findIndex(value => value.id === originalId.value)
    if (index < 0) list.push(site); else list[index] = site
    validateDashboard(dashboard.value); if (!editing.value) await save()
    metadataGeneration++; modal.value = null
  } catch (error) { dashboard.value = JSON.parse(before); modalError.value = (error as Error).message }
  finally { busy.value = false }
}
async function removeSite() {
  if (!window.confirm('删除这个网站？')) return
  busy.value = true; const before = JSON.stringify(dashboard.value)
  try { dashboard.value.sections[0]!.sites = dashboard.value.sections[0]!.sites.filter(site => site.id !== originalId.value); if (!editing.value) await save(); modal.value = null }
  catch (error) { dashboard.value = JSON.parse(before); modalError.value = (error as Error).message }
  finally { busy.value = false }
}
async function logout() {
  try { await api('/api/logout', { method: 'POST', body: '{}' }); accountOpen.value = false; authenticated.value = false; editing.value = false; dashboard.value = emptyDashboard() } catch (error) { flash((error as Error).message) }
}
function openPassword() { currentPassword.value = ''; nextPassword.value = ''; repeatPassword.value = ''; modalError.value = ''; accountOpen.value = false; modal.value = 'password' }
async function changePassword() {
  if (nextPassword.value !== repeatPassword.value) { modalError.value = '两次输入的密码不一致'; return }
  busy.value = true; modalError.value = ''
  try { await api('/api/password', { method: 'POST', body: JSON.stringify({ current: currentPassword.value, password: nextPassword.value }) }); modal.value = null; authenticated.value = false; editing.value = false; dashboard.value = emptyDashboard(); flash('密码已修改，请重新登录') }
  catch (error) { modalError.value = (error as Error).message } finally { busy.value = false }
}
function exportConfig() {
  const href = URL.createObjectURL(new Blob([JSON.stringify(dashboard.value, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = href; anchor.download = 'home-nav.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(href), 1000); accountOpen.value = false
}
async function importConfig(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return
  accountOpen.value = false
  if (file.size > 1500000) return flash('文件过大')
  try {
    const imported = validateDashboard(JSON.parse(await file.text()))
    if (!window.confirm('用导入的配置替换当前网站？')) return
    const before = dashboard.value; dashboard.value = imported
    try { await save(); flash('已导入') } catch (error) { dashboard.value = before; throw error }
  } catch (error) { flash((error as Error).message) }
}
function siteClick(event: MouseEvent, site: Site) { if (editing.value) { event.preventDefault(); openSite(site) } }
function moveSite(section: WebsiteSection, index: number, direction: number) { const target = index + direction; if (target < 0 || target >= section.sites.length) return; const [site] = section.sites.splice(index, 1); section.sites.splice(target, 0, site!) }
function windowResize() { width.value = window.innerWidth }
function outside(event: MouseEvent) { if (account.value && !account.value.contains(event.target as Node)) accountOpen.value = false }
function refreshVisible() { if (!document.hidden && authenticated.value && !editing.value && !modal.value && !busy.value) void loadDashboard().catch(error => flash(error.message)) }
function beforeUnload(event: BeforeUnloadEvent) { if (editing.value) event.preventDefault() }
onMounted(() => { void boot(); window.addEventListener('resize', windowResize); document.addEventListener('click', outside); document.addEventListener('visibilitychange', refreshVisible); window.addEventListener('beforeunload', beforeUnload) })
onUnmounted(() => { clearTimeout(noticeTimer); window.removeEventListener('resize', windowResize); document.removeEventListener('click', outside); document.removeEventListener('visibilitychange', refreshVisible); window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <div class="wallpaper" aria-hidden="true" /><div class="top-shade" aria-hidden="true" />
  <header class="toolbar">
    <a class="brand" href="/" aria-label="首页导航">首页导航</a>
    <div v-if="authenticated" class="toolbar-actions">
      <button class="icon-button" aria-label="添加网站" title="添加网站" :disabled="busy" @click="openSite()"><CirclePlus :size="22" :stroke-width="1.8" /></button>
      <div ref="account" class="account">
        <button class="avatar-button" aria-label="账户设置" :aria-expanded="accountOpen" aria-haspopup="menu" @click="accountOpen = !accountOpen"><img src="/avatar.png" alt="头像" /></button>
        <div v-if="accountOpen" class="account-menu" role="menu">
          <button role="menuitem" @click="openPassword"><KeyRound :size="17" />修改密码</button>
          <button role="menuitem" @click="exportConfig"><Download :size="17" />导出配置</button>
          <button role="menuitem" :disabled="editing" @click="upload?.click()"><Upload :size="17" />导入配置</button>
          <hr /><button role="menuitem" @click="logout"><LogOut :size="17" />退出登录</button>
        </div>
      </div>
    </div>
    <img v-else class="login-avatar" src="/avatar.png" alt="头像" />
  </header>

  <main v-if="loading || bootError" class="center-state"><LoaderCircle v-if="loading" class="spin" :size="28" /><div v-else class="error-state"><p>{{ bootError }}</p><button class="pill" @click="boot"><RotateCw :size="17" />重试</button></div></main>
  <main v-else-if="!authenticated" class="login-main">
    <form class="login-card glass" @submit.prevent="login">
      <img class="login-photo" src="/avatar.png" alt="头像" />
      <h1>首页导航</h1>
      <input v-model="password" type="password" placeholder="密码" aria-label="密码" autocomplete="current-password" required maxlength="256" :disabled="busy" />
      <TurnstileWidget ref="turnstile" :sitekey="sitekey" @token="token = $event" @error="loginError = '验证加载失败，请检查网络后刷新'" />
      <p v-if="loginError" class="form-error" role="alert">{{ loginError }}</p>
      <button class="primary-button" :disabled="busy || !password || !token" type="submit"><LoaderCircle v-if="busy" class="spin" :size="18" />登录</button>
    </form>
  </main>

  <main v-else class="desktop" :class="{ editing }">
    <div v-if="editing" class="edit-toolbar"><button :disabled="busy" @click="cancel">取消</button><span>自定义</span><button class="edit-done" :disabled="busy" @click="finish">{{ busy ? '保存中…' : '完成' }}</button></div>
    <div class="layout-shell">
      <GridLayout :layout="sections" :col-num="12" :row-height="1" :margin="[0, 0]" :is-draggable="false" :is-resizable="false" :use-css-transforms="true">
        <GridItem v-for="(section, index) in sections" :key="section.i" :i="section.i" :x="section.x" :y="section.y" :w="section.w" :h="section.h">
          <section class="app-library glass" aria-label="网站">
            <Draggable v-model="dashboard.sections[index]!.sites" class="app-icon-container" item-key="id" :disabled="!editing || busy" :animation="180" :delay="140" :delay-on-touch-only="true" :touch-start-threshold="5" ghost-class="drag-ghost" chosen-class="drag-chosen" :fallback-tolerance="5">
              <template #item="{ element: site, index: siteIndex }">
                <a class="app-icon-link" :href="site.url" target="_blank" rel="noopener noreferrer" :title="site.name" :aria-label="editing ? '编辑 ' + site.name : site.name" @click="siteClick($event, site)" @keydown.alt.left.prevent="editing && moveSite(dashboard.sections[index]!, siteIndex, -1)" @keydown.alt.right.prevent="editing && moveSite(dashboard.sections[index]!, siteIndex, 1)">
                  <SiteIcon :icon="site.icon" /><span class="app-displayname">{{ site.name }}</span><span v-if="editing" class="edit-badge"><Pencil :size="11" /></span>
                </a>
              </template>
              <template #footer><button v-if="!dashboard.sections[index]!.sites.length" class="empty-add" aria-label="添加网站" @click="openSite()"><Plus :size="32" :stroke-width="1.5" /></button></template>
            </Draggable>
          </section>
        </GridItem>
      </GridLayout>
    </div>
    <button class="customize-button pill" :disabled="busy" @click="editing ? finish() : customize()"><component :is="editing ? Check : WandSparkles" :size="17" :stroke-width="1.7" />{{ editing ? '完成' : '自定义' }}</button>
  </main>

  <div v-if="notice" class="toast" role="status">{{ notice }}</div>
  <input ref="upload" type="file" accept="application/json,.json" hidden @change="importConfig" />

  <DialogShell v-if="modal === 'site'" :title="originalId ? '编辑网站' : '添加网站'" :busy="busy" @close="closeModal">
    <form class="site-form" @submit.prevent="submitSite">
      <div class="site-preview"><SiteIcon :icon="form.icon" /></div>
      <label>网址<div class="url-field"><input v-model="form.url" type="url" placeholder="https://" required maxlength="2048" :disabled="busy" @change="getMetadata" /><button type="button" class="icon-button" aria-label="获取网站名称和图标" title="获取网站名称和图标" :disabled="busy || autoBusy || !form.url" @click="getMetadata"><RotateCw :size="17" :class="{ spin: autoBusy }" /></button></div></label>
      <label>名称<input v-model="form.name" placeholder="网站名称" maxlength="80" :disabled="busy" /></label>
      <div class="segmented"><button type="button" :class="{ active: form.icon.type === 'auto' }" @click="form.icon = { type: 'auto', value: '', color: '#007aff' }; getMetadata()">网站图标</button><button type="button" :class="{ active: form.icon.type === 'lucide' }" @click="form.icon = { type: 'lucide', value: 'Globe', color: '#007aff' }">Lucide 图标</button></div>
      <template v-if="form.icon.type === 'lucide'"><div class="color-options"><button v-for="color in ['#007aff', '#34a853', '#ff9500', '#af52de', '#ff3b30', '#242426']" :key="color" type="button" :style="{ background: color }" :class="{ selected: form.icon.color === color }" :aria-label="color" :aria-pressed="form.icon.color === color" @click="form.icon.color = color" /><input v-model="form.icon.color" type="color" aria-label="自定义颜色" /></div><IconPicker :selected="form.icon.value" @select="form.icon.value = $event" /></template>
      <p v-if="modalError" class="form-error" role="alert">{{ modalError }}</p>
      <footer class="dialog-footer"><button v-if="originalId" class="text-button danger" type="button" :disabled="busy" @click="removeSite">删除网站</button><button class="primary-button" type="submit" :disabled="busy || autoBusy">{{ busy ? '保存中…' : '保存' }}</button></footer>
    </form>
  </DialogShell>
  <DialogShell v-if="modal === 'password'" title="修改密码" :busy="busy" @close="closeModal"><form class="password-form" @submit.prevent="changePassword"><label>当前密码<input v-model="currentPassword" type="password" autocomplete="current-password" required maxlength="256" /></label><label>新密码<input v-model="nextPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="至少 8 个字符" /></label><label>确认新密码<input v-model="repeatPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="128" /></label><p v-if="modalError" class="form-error" role="alert">{{ modalError }}</p><footer class="dialog-footer"><button class="primary-button" :disabled="busy">保存</button></footer></form></DialogShell>
</template>
