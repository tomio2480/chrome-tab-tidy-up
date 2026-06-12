import {
  getAllGroups,
  getAllTabs,
  saveGroup,
  saveTab,
  saveTabIndex,
} from '../shared/storage'
import type { GroupRecord, TabRecord, TabState } from '../shared/types'

const UNGROUPED_GROUP_ID = -1

interface InitialSyncOptions {
  now?: () => number
  randomUUID?: () => string
}

export async function initializeStorageFromBrowser(options: InitialSyncOptions = {}): Promise<void> {
  const now = options.now ?? Date.now
  const randomUUID = options.randomUUID ?? (() => crypto.randomUUID())
  const timestamp = now()

  await syncGroups(timestamp)
  await syncTabs(timestamp, randomUUID)
}

async function syncGroups(timestamp: number): Promise<void> {
  if (chrome.tabGroups === undefined) return

  const [browserGroups, storedGroups] = await Promise.all([
    chrome.tabGroups.query({}),
    getAllGroups(),
  ])
  const storedGroupIds = new Set(storedGroups.map((group) => group.groupId))

  await Promise.all(
    browserGroups
      .filter((group) => !storedGroupIds.has(group.id))
      .map((group) => saveGroup(toGroupRecord(group, timestamp))),
  )
}

async function syncTabs(timestamp: number, randomUUID: () => string): Promise<void> {
  const [browserTabs, storedTabs] = await Promise.all([chrome.tabs.query({}), getAllTabs()])
  const storedTabsByTabId = new Map(
    storedTabs
      .filter((tab): tab is TabRecord & { tabId: number } => tab.tabId !== null)
      .map((tab) => [tab.tabId, tab]),
  )

  for (const tab of browserTabs) {
    const tabId = normalizeTabId(tab.id)
    if (tabId === null) continue

    const existingTab = storedTabsByTabId.get(tabId) ?? null
    if (existingTab !== null) {
      await saveTabIndex(tabId, existingTab.recordId)
      continue
    }

    const record = toTabRecord(tab, tabId, timestamp, randomUUID)
    if (record === null) continue

    await saveTab(record)
    await saveTabIndex(tabId, record.recordId)
  }
}

function toGroupRecord(group: chrome.tabGroups.TabGroup, timestamp: number): GroupRecord {
  return {
    groupId: group.id,
    title: group.title ?? '',
    color: group.color,
    createdAt: timestamp,
  }
}

function toTabRecord(
  tab: chrome.tabs.Tab,
  tabId: number,
  timestamp: number,
  randomUUID: () => string,
): TabRecord | null {
  const url = normalizeTabUrl(tab)
  if (url === null) return null

  return {
    recordId: randomUUID(),
    tabId,
    url,
    title: tab.title ?? url,
    firstOpened: timestamp,
    lastRefreshed: timestamp,
    state: toTabState(tab),
    groupId: normalizeGroupId(tab.groupId),
    windowId: tab.windowId ?? null,
  }
}

function toTabState(tab: chrome.tabs.Tab): TabState {
  return tab.discarded === true ? 'discarded' : 'open'
}

function normalizeTabId(tabId: number | undefined): number | null {
  return tabId ?? null
}

function normalizeTabUrl(tab: chrome.tabs.Tab): string | null {
  return tab.url || tab.pendingUrl || null
}

function normalizeGroupId(groupId: number | undefined): number | null {
  return groupId === undefined || groupId === UNGROUPED_GROUP_ID ? null : groupId
}
