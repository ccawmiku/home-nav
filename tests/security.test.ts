import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sameSecret, signSession, verifySession, hashPassword } from '../worker/auth.ts'
import { emptyDashboard, validateDashboard, websiteUrl } from '../shared/dashboard.ts'

test('password comparison and derived password checks', async () => {
  assert.equal(await sameSecret('a', 'a'), true)
  assert.equal(await sameSecret('a', 'b'), false)
  assert.equal(await sameSecret('', 'a'), false)
  const hash = await hashPassword('correct password', 'salt')
  assert.notEqual(hash, await hashPassword('other password', 'salt'))
  assert.notEqual(hash, await hashPassword('correct password', 'other salt'))
})
test('sessions reject tampering, expiration and revoked generations', async () => {
  const token = await signSession('test-key', 'v1', 1000)
  assert.equal(await verifySession(token, 'test-key', 'v1', 2000), true)
  assert.equal(await verifySession(token, 'wrong-key', 'v1', 2000), false)
  assert.equal(await verifySession(token, 'test-key', 'v2', 2000), false)
  assert.equal(await verifySession(token, 'test-key', 'v1', 1000 + 31 * 86400000), false)
  assert.equal(await verifySession(token + '.extra', 'test-key', 'v1', 2000), false)
  assert.equal(await verifySession('garbage', 'test-key', 'v1', 2000), false)
})
test('dashboard rejects unsafe URLs, duplicate IDs and HTML image data', () => {
  assert.throws(() => websiteUrl('javascript:alert(1)'))
  assert.throws(() => websiteUrl('https://user:secret@example.com'))
  assert.equal(websiteUrl('http://192.168.1.1:8080/'), 'http://192.168.1.1:8080/')
  const dashboard = emptyDashboard()
  const site = { id: 'one', name: 'Example', url: 'https://example.com/', icon: { type: 'lucide' as const, value: 'Globe' } }
  dashboard.sections[0]!.sites.push(site)
  assert.equal(validateDashboard(dashboard), dashboard)
  dashboard.sections[0]!.sites.push({ ...site })
  assert.throws(() => validateDashboard(dashboard))
  dashboard.sections[0]!.sites.pop()
  dashboard.sections[0]!.sites[0]!.icon = { type: 'auto', value: 'data:text/html;base64,PHN2Zz4=' }
  assert.throws(() => validateDashboard(dashboard))
})
