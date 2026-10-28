import { test } from 'node:test'
import assert from 'node:assert/strict'
import { homepageLayout, libraryHeight } from '../src/layout.ts'

test('original homepage breakpoints keep medium screens on the small app tile', () => {
  for (const width of [320, 393, 759]) {
    const layout = homepageLayout(width)
    assert.equal(layout.mode, 'sm')
    assert.equal(layout.gridWidth, 345)
    assert.equal(layout.cardWidth, 315)
    assert.equal(layout.columns, 4)
  }
  for (const width of [760, 1024, 1164]) {
    const layout = homepageLayout(width)
    assert.equal(layout.mode, 'md')
    assert.equal(layout.gridWidth, 690)
    assert.equal(layout.cardWidth, 315)
    assert.equal(layout.columns, 4)
    assert.equal(layout.editorWidth, 690)
  }
  for (const width of [1165, 1440, 1920]) {
    const layout = homepageLayout(width)
    assert.equal(layout.gridWidth, 1035)
    assert.equal(layout.cardWidth, 660)
    assert.equal(layout.columns, 6)
  }
  assert.equal(homepageLayout(1689).editorWidth, 1035)
  assert.equal(homepageLayout(1690).editorWidth, 1380)
})

test('twelve shortcuts retain the original tile height and larger collections remain accessible', () => {
  for (const large of [false, true]) {
    for (const editing of [false, true]) {
      assert.equal(libraryHeight(12, large, editing), 315)
      assert.ok(libraryHeight(40, large, editing) > 315)
    }
  }
})
