export type TabState = 'open' | 'discarded' | 'closed'

export interface TabRecord {
  recordId: string
  tabId: number | null
  url: string
  title: string
  firstOpened: number
  lastRefreshed: number
  state: TabState
  groupId: number | null
  windowId: number | null
}

export type GroupColor = chrome.tabGroups.TabGroup['color']

export interface GroupRecord {
  groupId: number
  title: string
  color: GroupColor
  createdAt: number
}
