import {
  deleteAllTabIndexes,
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
  reconnectExistingTabs?: boolean
}

interface BrowserTabSnapshot {
  tabId: number
  url: string
  title: string
  state: TabState
  groupId: number | null
  windowId: number | null
}

type ReconnectFingerprintInput = Pick<
  BrowserTabSnapshot,
  'url' | 'title' | 'state' | 'groupId' | 'windowId'
>

export async function initializeStorageFromBrowser(options: InitialSyncOptions = {}): Promise<void> {
  const now = options.now ?? Date.now
  const randomUUID = options.randomUUID ?? (() => crypto.randomUUID())
  const timestamp = now()

  await syncGroups(timestamp)
  await syncTabs(timestamp, randomUUID, options.reconnectExistingTabs === true)
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

async function syncTabs(
  timestamp: number,
  randomUUID: () => string,
  reconnectExistingTabs: boolean,
): Promise<void> {
  const [browserTabs, storedTabs] = await Promise.all([chrome.tabs.query({}), getAllTabs()])

  if (reconnectExistingTabs) {
    await reconnectTabsFromBrowserSession(browserTabs, storedTabs, timestamp, randomUUID)
    return
  }

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

    const record = toTabRecord(tab, timestamp, randomUUID)
    if (record === null) continue

    await saveTab(record)
    await saveTabIndex(tabId, record.recordId)
  }
}

async function reconnectTabsFromBrowserSession(
  browserTabs: chrome.tabs.Tab[],
  storedTabs: TabRecord[],
  timestamp: number,
  randomUUID: () => string,
): Promise<void> {
  await deleteAllTabIndexes()

  const browserSnapshots = browserTabs
    .map(toBrowserTabSnapshot)
    .filter((snapshot): snapshot is BrowserTabSnapshot => snapshot !== null)
  const browserFingerprints = countFingerprints(
    browserSnapshots.map((snapshot) => toReconnectFingerprint(snapshot)),
  )
  const storedFingerprints = countFingerprints(
    storedTabs
      .filter((tab) => tab.state !== 'closed')
      .map((tab) => toReconnectFingerprint(tab)),
  )
  const storedTabsByFingerprint = new Map(
    storedTabs
      .filter((tab) => tab.state !== 'closed')
      .map((tab) => [toReconnectFingerprint(tab), tab]),
  )
  const matchedRecordIds = new Set<string>()

  for (const snapshot of browserSnapshots) {
    const fingerprint = toReconnectFingerprint(snapshot)
    const existingTab =
      browserFingerprints.get(fingerprint) === 1 && storedFingerprints.get(fingerprint) === 1
        ? storedTabsByFingerprint.get(fingerprint)
        : undefined

    if (existingTab !== undefined) {
      const record = {
        ...existingTab,
        ...snapshot,
        lastRefreshed: timestamp,
      }
      await saveTab(record)
      await saveTabIndex(snapshot.tabId, record.recordId)
      matchedRecordIds.add(record.recordId)
      continue
    }

    const record = toTabRecordFromSnapshot(snapshot, timestamp, randomUUID)
    await saveTab(record)
    await saveTabIndex(snapshot.tabId, record.recordId)
  }

  for (const storedTab of storedTabs) {
    if (matchedRecordIds.has(storedTab.recordId) || storedTab.tabId === null) continue

    await saveTab({
      ...storedTab,
      tabId: null,
      state: 'closed',
      lastRefreshed: timestamp,
    })
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
  timestamp: number,
  randomUUID: () => string,
): TabRecord | null {
  const snapshot = toBrowserTabSnapshot(tab)
  if (snapshot === null) return null

  return toTabRecordFromSnapshot(snapshot, timestamp, randomUUID)
}

function toTabRecordFromSnapshot(
  snapshot: BrowserTabSnapshot,
  timestamp: number,
  randomUUID: () => string,
): TabRecord {
  return {
    recordId: randomUUID(),
    ...snapshot,
    firstOpened: timestamp,
    lastRefreshed: timestamp,
  }
}

function toBrowserTabSnapshot(tab: chrome.tabs.Tab): BrowserTabSnapshot | null {
  const tabId = normalizeTabId(tab.id)
  const url = normalizeTabUrl(tab)
  if (tabId === null || url === null) return null

  return {
    tabId,
    url,
    title: tab.title ?? url,
    state: toTabState(tab),
    groupId: normalizeGroupId(tab.groupId),
    windowId: tab.windowId ?? null,
  }
}

function countFingerprints(fingerprints: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const fingerprint of fingerprints) {
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1)
  }

  return counts
}

function toReconnectFingerprint(tab: ReconnectFingerprintInput): string {
  return [tab.url, tab.title, tab.state, tab.groupId ?? '', tab.windowId ?? ''].join('\0')
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
