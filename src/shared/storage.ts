import { groupRecordSchema, tabRecordSchema } from './schemas'
import type { GroupRecord, TabRecord } from './types'

const TAB_PREFIX = 'tab:'
const GROUP_PREFIX = 'group:'
const TAB_INDEX_PREFIX = 'index:tabId:'

export async function saveTab(record: TabRecord): Promise<void> {
  await chrome.storage.local.set({ [`${TAB_PREFIX}${record.recordId}`]: record })
}

export async function getTab(recordId: string): Promise<TabRecord | null> {
  const key = `${TAB_PREFIX}${recordId}`
  const result = await chrome.storage.local.get(key)
  if (!(key in result)) return null
  return tabRecordSchema.parse(result[key])
}

export async function deleteTab(recordId: string): Promise<void> {
  await chrome.storage.local.remove(`${TAB_PREFIX}${recordId}`)
}

export async function getAllTabs(): Promise<TabRecord[]> {
  const all = await chrome.storage.local.get(null)
  return Object.entries(all)
    .filter(([k]) => k.startsWith(TAB_PREFIX))
    .map(([, v]) => tabRecordSchema.parse(v))
}

export async function saveGroup(record: GroupRecord): Promise<void> {
  await chrome.storage.local.set({ [`${GROUP_PREFIX}${record.groupId}`]: record })
}

export async function getGroup(groupId: number): Promise<GroupRecord | null> {
  const key = `${GROUP_PREFIX}${groupId}`
  const result = await chrome.storage.local.get(key)
  if (!(key in result)) return null
  return groupRecordSchema.parse(result[key])
}

export async function deleteGroup(groupId: number): Promise<void> {
  await chrome.storage.local.remove(`${GROUP_PREFIX}${groupId}`)
}

export async function getAllGroups(): Promise<GroupRecord[]> {
  const all = await chrome.storage.local.get(null)
  return Object.entries(all)
    .filter(([k]) => k.startsWith(GROUP_PREFIX))
    .map(([, v]) => groupRecordSchema.parse(v))
}

export async function saveTabIndex(tabId: number, recordId: string): Promise<void> {
  await chrome.storage.local.set({ [`${TAB_INDEX_PREFIX}${tabId}`]: recordId })
}

export async function getTabIndex(tabId: number): Promise<string | null> {
  const key = `${TAB_INDEX_PREFIX}${tabId}`
  const result = await chrome.storage.local.get(key)
  if (!(key in result)) return null
  return result[key] as string
}

export async function deleteTabIndex(tabId: number): Promise<void> {
  await chrome.storage.local.remove(`${TAB_INDEX_PREFIX}${tabId}`)
}
