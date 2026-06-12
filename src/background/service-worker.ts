import { initializeStorageFromBrowser } from './initialSync'

function runInitialSync(): void {
  void initializeStorageFromBrowser().catch((error: unknown) => {
    console.error('Failed to initialize tab tidy storage', error)
  })
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    runInitialSync()
  }
})
