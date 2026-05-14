import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteGroup,
  deleteTab,
  deleteTabIndex,
  getAllGroups,
  getAllTabs,
  getGroup,
  getTab,
  getTabIndex,
  saveGroup,
  saveTab,
  saveTabIndex,
} from '../src/shared/storage'
import type { GroupRecord, TabRecord } from '../src/shared/types'

const makeTab = (overrides: Partial<TabRecord> = {}): TabRecord => ({
  recordId: '550e8400-e29b-41d4-a716-446655440000',
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

const makeGroup = (overrides: Partial<GroupRecord> = {}): GroupRecord => ({
  groupId: 10,
  title: 'Work',
  color: 'blue',
  createdAt: 1_700_000_000_000,
  ...overrides,
})

const store: Record<string, unknown> = {}

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | null) => {
        if (keys === null) return { ...store }
        const ks = typeof keys === 'string' ? [keys] : keys
        return Object.fromEntries(ks.filter((k) => k in store).map((k) => [k, store[k]]))
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items)
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const ks = typeof keys === 'string' ? [keys] : keys
        for (const k of ks) delete store[k]
      }),
    },
  },
}

beforeEach(() => {
  vi.stubGlobal('chrome', chromeMock)
  for (const k of Object.keys(store)) delete store[k]
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('saveTab / getTab', () => {
  it('タブを保存して取得できる', async () => {
    const tab = makeTab()
    await saveTab(tab)
    const result = await getTab(tab.recordId)
    expect(result).toEqual(tab)
  })

  it('存在しない recordId は null を返す', async () => {
    const result = await getTab('non-existent-id')
    expect(result).toBeNull()
  })
})

describe('deleteTab', () => {
  it('保存済みタブを削除できる', async () => {
    const tab = makeTab()
    await saveTab(tab)
    await deleteTab(tab.recordId)
    expect(await getTab(tab.recordId)).toBeNull()
  })
})

describe('getAllTabs', () => {
  it('保存済みのすべてのタブを返す', async () => {
    const tab1 = makeTab({ recordId: '550e8400-e29b-41d4-a716-446655440001' })
    const tab2 = makeTab({ recordId: '550e8400-e29b-41d4-a716-446655440002' })
    await saveTab(tab1)
    await saveTab(tab2)
    const all = await getAllTabs()
    expect(all).toHaveLength(2)
    expect(all).toEqual(expect.arrayContaining([tab1, tab2]))
  })

  it('タブが 0 件のとき空配列を返す', async () => {
    expect(await getAllTabs()).toEqual([])
  })
})

describe('saveGroup / getGroup', () => {
  it('グループを保存して取得できる', async () => {
    const group = makeGroup()
    await saveGroup(group)
    const result = await getGroup(group.groupId)
    expect(result).toEqual(group)
  })

  it('存在しない groupId は null を返す', async () => {
    expect(await getGroup(999)).toBeNull()
  })
})

describe('deleteGroup', () => {
  it('保存済みグループを削除できる', async () => {
    const group = makeGroup()
    await saveGroup(group)
    await deleteGroup(group.groupId)
    expect(await getGroup(group.groupId)).toBeNull()
  })
})

describe('getAllGroups', () => {
  it('保存済みのすべてのグループを返す', async () => {
    const g1 = makeGroup({ groupId: 1 })
    const g2 = makeGroup({ groupId: 2 })
    await saveGroup(g1)
    await saveGroup(g2)
    const all = await getAllGroups()
    expect(all).toHaveLength(2)
    expect(all).toEqual(expect.arrayContaining([g1, g2]))
  })

  it('グループが 0 件のとき空配列を返す', async () => {
    expect(await getAllGroups()).toEqual([])
  })
})

describe('saveTabIndex / getTabIndex', () => {
  it('tabId → recordId の逆引きを保存して取得できる', async () => {
    await saveTabIndex(42, 'rec-001')
    expect(await getTabIndex(42)).toBe('rec-001')
  })

  it('存在しない tabId は null を返す', async () => {
    expect(await getTabIndex(999)).toBeNull()
  })
})

describe('deleteTabIndex', () => {
  it('逆引きインデックスを削除できる', async () => {
    await saveTabIndex(42, 'rec-001')
    await deleteTabIndex(42)
    expect(await getTabIndex(42)).toBeNull()
  })
})
