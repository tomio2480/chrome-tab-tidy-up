import type { TabRecord } from './types'

export function findDuplicateGroups(tabs: TabRecord[]): Map<string, TabRecord[]> {
  const urlMap = new Map<string, TabRecord[]>()

  for (const tab of tabs) {
    if (tab.state === 'closed') continue
    const group = urlMap.get(tab.url)
    if (group) {
      group.push(tab)
    } else {
      urlMap.set(tab.url, [tab])
    }
  }

  for (const [url, group] of urlMap) {
    if (group.length < 2) urlMap.delete(url)
  }

  return urlMap
}
