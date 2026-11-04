import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountUsage, accountUsageSnapshot } from '../worker/account-usage.ts'
import { productPeak, quotaPercent } from '../shared/account-usage.ts'
import { emptyDashboard, validateDashboard, withQuotaSection } from '../shared/dashboard.ts'
import { dashboardGrid } from '../src/layout.ts'

const raw = () => ({
  workers: [{ sum: { requests: 900, cpuTimeUs: 3000 } }],
  doRequests: [{ sum: { requests: 500 } }],
  doUsage: [{ sum: { duration: 14620.54, rowsRead: 300, rowsWritten: 400 } }],
  d1: [{ sum: { rowsRead: 12345, rowsWritten: 678 } }],
  workflows: [{ sum: { stepCount: 42, cpuTime: 12 } }], workflowStarts: [{ count: 13 }],
  d1Storage: [{ max: { databaseSizeBytes: 200 } }, { max: { databaseSizeBytes: 300 } }],
  doStorage: [{ max: { storedBytes: 100 } }],
})
function cacheFixture() {
  const values = new Map<string, Response>()
  return {
    match: async (request: RequestInfo | URL) => values.get(request instanceof Request ? request.url : String(request))?.clone(),
    put: async (request: RequestInfo | URL, response: Response) => { values.set(request instanceof Request ? request.url : String(request), response.clone()) },
  }
}
const env = { CF_ANALYTICS_TOKEN: 'synthetic-test-token', CF_ANALYTICS_ACCOUNT_ID: '1'.repeat(32) }

test('legacy dashboards gain one quota tile without changing sites, hidden state or IDs', () => {
  const original = emptyDashboard(); original.sections.pop()
  original.sections[0]!.hidden = true
  const upgraded = withQuotaSection(validateDashboard(original))
  assert.equal(upgraded.sections.length, 2)
  assert.equal(upgraded.sections[0], original.sections[0])
  assert.equal(withQuotaSection(upgraded), upgraded)
  upgraded.sections[1]!.hidden = true
  assert.equal(withQuotaSection(upgraded).sections[1]!.hidden, true)
  assert.equal(validateDashboard(upgraded), upgraded)
  assert.throws(() => validateDashboard({ ...upgraded, sections: [upgraded.sections[0], upgraded.sections[0]] }))
  assert.throws(() => validateDashboard({ ...upgraded, sections: [{ ...upgraded.sections[0], id: 'cloudflare' }, upgraded.sections[1]] }))
})

test('new widgets fit the original grid and grow below long shortcut collections without overlap', () => {
  const dashboard = emptyDashboard()
  for (const width of [320, 393, 759, 760, 1024, 1164, 1165, 1440, 1920]) {
    const grid = dashboardGrid(dashboard.sections, width, false)
    const [sites, quota] = grid.items
    assert.ok(sites && quota)
    assert.equal(grid.width, width < 760 ? 345 : width < 1165 ? 690 : 1035)
    assert.equal(sites.w, width >= 1165 ? 2 : 1)
    assert.ok(quota.x >= sites.x + sites.w || quota.y >= sites.y + sites.h)
  }
  const sites = dashboard.sections.find(section => section.type === 'websites')!
  sites.sites = Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: String(i), url: 'https://example.com', icon: { type: 'auto' as const, value: '' } }))
  const mobile = dashboardGrid(dashboard.sections, 393, false)
  assert.ok(mobile.items[1]!.y >= mobile.items[0]!.h)
  dashboard.sections[0]!.hidden = true
  assert.equal(dashboardGrid(dashboard.sections, 1440, false).width, 345)
  dashboard.sections[1]!.hidden = true
  assert.deepEqual(dashboardGrid(dashboard.sections, 393, false).items, [])
})

test('quota summaries preserve unknowns, valid zero, storage peaks and percentages above 100', () => {
  const snapshot = accountUsageSnapshot(raw(), Date.UTC(2026, 10, 4, 3))
  assert.equal(snapshot.metrics.length, 14)
  assert.equal(productPeak(snapshot, 'Durable Objects')!.id, 'do-duration')
  assert.ok(quotaPercent(productPeak(snapshot, 'Durable Objects')!)! > 100)
  assert.equal(snapshot.metrics.find(metric => metric.id === 'workers-cpu')!.limit, null)
  assert.equal(snapshot.metrics.find(metric => metric.id === 'workflow-invocations')!.limit, null)
  assert.equal(snapshot.metrics.find(metric => metric.id === 'workflow-storage')!.value, null)
  assert.equal(snapshot.metrics.find(metric => metric.id === 'd1-storage')!.value, 500)
  const missing = accountUsageSnapshot({ workers: [], d1Storage: [] }, Date.now())
  assert.equal(productPeak(missing, 'Workers')!.value, 0)
  assert.equal(productPeak(missing, 'D1'), undefined)
  assert.equal(missing.metrics.find(metric => metric.id === 'd1-storage')!.value, null)
})

test('edge cache limits refreshes and discards yesterday at the UTC reset', async t => {
  let now = Date.UTC(2026, 10, 4, 3), calls = 0
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    calls++; assert.equal(init.redirect, 'manual')
    return Response.json({ data: { viewer: { accounts: [raw()] } } })
  })
  const cache = cacheFixture()
  await accountUsage(env, false, cache); await accountUsage(env, false, cache); await accountUsage(env, true, cache)
  assert.equal(calls, 1)
  now += 61000; await accountUsage(env, true, cache); assert.equal(calls, 2)
  now += 240000; await accountUsage(env, false, cache); assert.equal(calls, 2)
  now += 61000; await accountUsage(env, false, cache); assert.equal(calls, 3)
  now = Date.UTC(2026, 10, 5); const next = await accountUsage(env, false, cache)
  assert.equal(calls, 4); assert.equal(next.day, '2026-11-05')
})

test('upstream failures retain known data, back off, and never return credentials or raw errors', async t => {
  let now = Date.UTC(2026, 10, 4, 3), fail = false, calls = 0
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return fail ? new Response(env.CF_ANALYTICS_TOKEN, { status: 403 }) : Response.json({ data: { viewer: { accounts: [raw()] } } })
  })
  const cache = cacheFixture(), good = await accountUsage(env, false, cache)
  now += 301000; fail = true
  const stale = await accountUsage(env, false, cache)
  assert.equal(stale.status, 'stale'); assert.equal(stale.fetchedAt, good.fetchedAt)
  await accountUsage(env, true, cache); assert.equal(calls, 2)
  const failure = await accountUsage(env, false, cacheFixture())
  assert.equal(failure.status, 'error'); assert.equal(failure.fetchedAt, null)
  assert.equal(JSON.stringify([stale, failure]).includes(env.CF_ANALYTICS_TOKEN), false)
  const unconfigured = await accountUsage({ ...env, CF_ANALYTICS_TOKEN: '' }, false, cache)
  assert.equal(unconfigured.status, 'unconfigured')
})
