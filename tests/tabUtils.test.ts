import { describe, expect, it } from 'vitest'
import { findDuplicateGroups } from '../src/shared/tabUtils'
import type { TabRecord } from '../src/shared/types'

const makeTab = (overrides: Partial<TabRecord>): TabRecord => ({
  recordId: crypto.randomUUID(),
  tabId: 1,
  url: 'https://example.com',
  title: 'Example',
  firstOpened: 1_700_000_000_000,
  lastRefreshed: 1_700_000_001_000,
  state: 'open',
  groupId: null,
  windowId: 1,
  ...overrides,
})

describe('findDuplicateGroups', () => {
  it('重複のないタブ一覧は空 Map を返す', () => {
    const tabs = [
      makeTab({ url: 'https://example.com' }),
      makeTab({ url: 'https://other.com' }),
    ]
    expect(findDuplicateGroups(tabs).size).toBe(0)
  })

  it('同一 URL の open タブが 2 件あれば重複グループを返す', () => {
    const t1 = makeTab({ url: 'https://dup.com', state: 'open' })
    const t2 = makeTab({ url: 'https://dup.com', state: 'open' })
    const result = findDuplicateGroups([t1, t2])
    expect(result.size).toBe(1)
    expect(result.get('https://dup.com')).toEqual(expect.arrayContaining([t1, t2]))
  })

  it('discarded タブも重複検出の対象に含める', () => {
    const t1 = makeTab({ url: 'https://dup.com', state: 'open' })
    const t2 = makeTab({ url: 'https://dup.com', state: 'discarded' })
    const result = findDuplicateGroups([t1, t2])
    expect(result.size).toBe(1)
  })

  it('closed タブは重複検出の対象から除外する', () => {
    const t1 = makeTab({ url: 'https://dup.com', state: 'open' })
    const t2 = makeTab({ url: 'https://dup.com', state: 'closed', tabId: null })
    const result = findDuplicateGroups([t1, t2])
    expect(result.size).toBe(0)
  })

  it('3 件以上の重複も正しくグループ化する', () => {
    const t1 = makeTab({ url: 'https://dup.com', state: 'open' })
    const t2 = makeTab({ url: 'https://dup.com', state: 'open' })
    const t3 = makeTab({ url: 'https://dup.com', state: 'discarded' })
    const result = findDuplicateGroups([t1, t2, t3])
    expect(result.get('https://dup.com')).toHaveLength(3)
  })

  it('複数の重複 URL を同時に検出する', () => {
    const t1 = makeTab({ url: 'https://a.com', state: 'open' })
    const t2 = makeTab({ url: 'https://a.com', state: 'open' })
    const t3 = makeTab({ url: 'https://b.com', state: 'open' })
    const t4 = makeTab({ url: 'https://b.com', state: 'open' })
    const result = findDuplicateGroups([t1, t2, t3, t4])
    expect(result.size).toBe(2)
  })

  it('空配列を渡すと空 Map を返す', () => {
    expect(findDuplicateGroups([]).size).toBe(0)
  })

  it('closed タブのみの場合は空 Map を返す', () => {
    const tabs = [
      makeTab({ url: 'https://dup.com', state: 'closed', tabId: null }),
      makeTab({ url: 'https://dup.com', state: 'closed', tabId: null }),
    ]
    expect(findDuplicateGroups(tabs).size).toBe(0)
  })
})
