import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeStorageFromBrowser } from '../src/background/initialSync'
import {
  getAllGroups,
  getAllTabs,
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
  runtime: {
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn((keys: string | string[] | null) => {
        if (keys === null) return Promise.resolve({ ...store })
        const ks = typeof keys === 'string' ? [keys] : keys
        return Promise.resolve(
          Object.fromEntries(ks.filter((key) => key in store).map((key) => [key, store[key]])),
        )
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(store, items)
        return Promise.resolve()
      }),
      remove: vi.fn((keys: string | string[]) => {
        const ks = typeof keys === 'string' ? [keys] : keys
        for (const key of ks) delete store[key]
        return Promise.resolve()
      }),
    },
  },
  tabs: {
    query: vi.fn(),
  },
  tabGroups: {
    query: vi.fn(),
  },
}

beforeEach(() => {
  vi.stubGlobal('chrome', chromeMock)
  for (const key of Object.keys(store)) delete store[key]
  chromeMock.tabs.query.mockReturnValue(Promise.resolve([]))
  chromeMock.tabGroups.query.mockReturnValue(Promise.resolve([]))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('initializeStorageFromBrowser', () => {
  it('現在開いているタブとグループを初期保存する', async () => {
    chromeMock.tabGroups.query.mockReturnValue(
      Promise.resolve([{ id: 10, title: 'Work', color: 'blue' }]),
    )
    chromeMock.tabs.query.mockReturnValue(
      Promise.resolve([
        {
          id: 1,
          url: 'https://example.com',
          title: 'Example',
          discarded: false,
          groupId: 10,
          windowId: 100,
        },
        {
          id: 2,
          url: 'https://sleep.example.com',
          title: 'Sleep',
          discarded: true,
          groupId: -1,
          windowId: 100,
        },
      ]),
    )

    await initializeStorageFromBrowser({
      now: () => 1_700_000_123_000,
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440001')
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440002'),
    })

    expect(await getAllGroups()).toEqual([
      {
        groupId: 10,
        title: 'Work',
        color: 'blue',
        createdAt: 1_700_000_123_000,
      },
    ])
    expect(await getAllTabs()).toEqual(
      expect.arrayContaining([
        {
          recordId: '550e8400-e29b-41d4-a716-446655440001',
          tabId: 1,
          url: 'https://example.com',
          title: 'Example',
          firstOpened: 1_700_000_123_000,
          lastRefreshed: 1_700_000_123_000,
          state: 'open',
          groupId: 10,
          windowId: 100,
        },
        {
          recordId: '550e8400-e29b-41d4-a716-446655440002',
          tabId: 2,
          url: 'https://sleep.example.com',
          title: 'Sleep',
          firstOpened: 1_700_000_123_000,
          lastRefreshed: 1_700_000_123_000,
          state: 'discarded',
          groupId: null,
          windowId: 100,
        },
      ]),
    )
    expect(await getTabIndex(1)).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(await getTabIndex(2)).toBe('550e8400-e29b-41d4-a716-446655440002')
  })

  it('既存データを上書きせず、欠けている tabId インデックスだけ復元する', async () => {
    const existingGroup = makeGroup({ title: 'Existing' })
    const existingTab = makeTab({
      recordId: '550e8400-e29b-41d4-a716-446655440010',
      title: 'Existing tab',
    })
    await saveGroup(existingGroup)
    await saveTab(existingTab)
    chromeMock.tabGroups.query.mockReturnValue(
      Promise.resolve([{ id: 10, title: 'Renamed in browser', color: 'red' }]),
    )
    chromeMock.tabs.query.mockReturnValue(
      Promise.resolve([
        {
          id: 1,
          url: 'https://example.com/changed',
          title: 'Changed',
          discarded: false,
          groupId: 10,
          windowId: 1,
        },
      ]),
    )

    await initializeStorageFromBrowser({
      now: () => 1_800_000_000_000,
      randomUUID: () => '550e8400-e29b-41d4-a716-446655440011',
    })

    expect(await getAllGroups()).toEqual([existingGroup])
    expect(await getAllTabs()).toEqual([existingTab])
    expect(await getTabIndex(1)).toBe(existingTab.recordId)
  })

  it('URL または tabId を取得できないタブは保存しない', async () => {
    chromeMock.tabs.query.mockReturnValue(
      Promise.resolve([
        { id: 1, title: 'No URL', discarded: false, groupId: -1, windowId: 1 },
        {
          url: 'https://example.com/no-id',
          title: 'No ID',
          discarded: false,
          groupId: -1,
          windowId: 1,
        },
      ]),
    )

    await initializeStorageFromBrowser({
      now: () => 1_700_000_123_000,
      randomUUID: () => '550e8400-e29b-41d4-a716-446655440020',
    })

    expect(await getAllTabs()).toEqual([])
  })

  it('空文字 URL は pendingUrl にフォールバックし、どちらも空なら保存しない', async () => {
    chromeMock.tabs.query.mockReturnValue(
      Promise.resolve([
        {
          id: 1,
          url: '',
          pendingUrl: 'https://pending.example.com',
          title: 'Pending',
          discarded: false,
          groupId: -1,
          windowId: 1,
        },
        {
          id: 2,
          url: '',
          title: 'Empty URL',
          discarded: false,
          groupId: -1,
          windowId: 1,
        },
      ]),
    )

    await initializeStorageFromBrowser({
      now: () => 1_700_000_123_000,
      randomUUID: () => '550e8400-e29b-41d4-a716-446655440050',
    })

    expect(await getAllTabs()).toEqual([
      {
        recordId: '550e8400-e29b-41d4-a716-446655440050',
        tabId: 1,
        url: 'https://pending.example.com',
        title: 'Pending',
        firstOpened: 1_700_000_123_000,
        lastRefreshed: 1_700_000_123_000,
        state: 'open',
        groupId: null,
        windowId: 1,
      },
    ])
  })

  it('タブグループ API がない環境でもタブ同期を継続する', async () => {
    vi.stubGlobal('chrome', {
      ...chromeMock,
      tabGroups: undefined,
    })
    chromeMock.tabs.query.mockReturnValue(
      Promise.resolve([
        {
          id: 1,
          url: 'https://example.com',
          title: 'Example',
          discarded: false,
        },
      ]),
    )

    await initializeStorageFromBrowser({
      now: () => 1_700_000_123_000,
      randomUUID: () => '550e8400-e29b-41d4-a716-446655440030',
    })

    expect(await getAllGroups()).toEqual([])
    expect(await getAllTabs()).toEqual([
      {
        recordId: '550e8400-e29b-41d4-a716-446655440030',
        tabId: 1,
        url: 'https://example.com',
        title: 'Example',
        firstOpened: 1_700_000_123_000,
        lastRefreshed: 1_700_000_123_000,
        state: 'open',
        groupId: null,
        windowId: null,
      },
    ])
  })

  it('タブ保存の storage 書き込みを順次実行する', async () => {
    let activeWrites = 0
    let maxActiveWrites = 0

    chromeMock.storage.local.set.mockImplementation(
      (items: Record<string, unknown>) =>
        new Promise<void>((resolve) => {
          activeWrites += 1
          maxActiveWrites = Math.max(maxActiveWrites, activeWrites)

          setTimeout(() => {
            Object.assign(store, items)
            activeWrites -= 1
            resolve()
          }, 0)
        }),
    )
    chromeMock.tabs.query.mockReturnValue(
      Promise.resolve([
        {
          id: 1,
          url: 'https://example.com/1',
          title: 'One',
          discarded: false,
          groupId: -1,
          windowId: 1,
        },
        {
          id: 2,
          url: 'https://example.com/2',
          title: 'Two',
          discarded: false,
          groupId: -1,
          windowId: 1,
        },
      ]),
    )

    await initializeStorageFromBrowser({
      now: () => 1_700_000_123_000,
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440040')
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440041'),
    })

    expect(maxActiveWrites).toBe(1)
  })

  it('起動時は古い tabId index を削除し、一意に一致するタブだけ再接続する', async () => {
    const existingTab = makeTab({
      recordId: '550e8400-e29b-41d4-a716-446655440060',
      tabId: 99,
      groupId: 10,
      windowId: 100,
    })
    await saveTab(existingTab)
    await saveTabIndex(99, existingTab.recordId)
    chromeMock.tabs.query.mockReturnValue(
      Promise.resolve([
        {
          id: 1,
          url: 'https://example.com',
          title: 'Example',
          discarded: false,
          groupId: 10,
          windowId: 100,
        },
      ]),
    )

    await initializeStorageFromBrowser({
      now: () => 1_800_000_000_000,
      randomUUID: () => '550e8400-e29b-41d4-a716-446655440061',
      reconnectExistingTabs: true,
    })

    expect(await getTabIndex(99)).toBeNull()
    expect(await getTabIndex(1)).toBe(existingTab.recordId)
    expect(await getTab(existingTab.recordId)).toEqual({
      ...existingTab,
      tabId: 1,
      lastRefreshed: 1_800_000_000_000,
    })
  })

  it('起動時に重複タブがある場合は既存レコードへ推測で紐付けない', async () => {
    const firstExistingTab = makeTab({
      recordId: '550e8400-e29b-41d4-a716-446655440070',
      tabId: 90,
      url: 'https://duplicate.example.com',
      title: 'Duplicate',
      windowId: 100,
    })
    const secondExistingTab = makeTab({
      recordId: '550e8400-e29b-41d4-a716-446655440071',
      tabId: 91,
      url: 'https://duplicate.example.com',
      title: 'Duplicate',
      windowId: 100,
    })
    await saveTab(firstExistingTab)
    await saveTab(secondExistingTab)
    await saveTabIndex(90, firstExistingTab.recordId)
    await saveTabIndex(91, secondExistingTab.recordId)
    chromeMock.tabs.query.mockReturnValue(
      Promise.resolve([
        {
          id: 1,
          url: 'https://duplicate.example.com',
          title: 'Duplicate',
          discarded: false,
          groupId: -1,
          windowId: 100,
        },
        {
          id: 2,
          url: 'https://duplicate.example.com',
          title: 'Duplicate',
          discarded: false,
          groupId: -1,
          windowId: 100,
        },
      ]),
    )

    await initializeStorageFromBrowser({
      now: () => 1_800_000_000_000,
      randomUUID: vi
        .fn()
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440072')
        .mockReturnValueOnce('550e8400-e29b-41d4-a716-446655440073'),
      reconnectExistingTabs: true,
    })

    expect(await getTabIndex(90)).toBeNull()
    expect(await getTabIndex(91)).toBeNull()
    expect(await getTabIndex(1)).toBe('550e8400-e29b-41d4-a716-446655440072')
    expect(await getTabIndex(2)).toBe('550e8400-e29b-41d4-a716-446655440073')
    expect(await getTab(firstExistingTab.recordId)).toEqual({
      ...firstExistingTab,
      tabId: null,
      state: 'closed',
      lastRefreshed: 1_800_000_000_000,
    })
    expect(await getTab(secondExistingTab.recordId)).toEqual({
      ...secondExistingTab,
      tabId: null,
      state: 'closed',
      lastRefreshed: 1_800_000_000_000,
    })
  })
})
