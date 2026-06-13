import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  initializeStorageFromBrowser: vi.fn(() => Promise.resolve()),
}))

vi.mock('../src/background/initialSync', () => ({
  initializeStorageFromBrowser: mocks.initializeStorageFromBrowser,
}))

let onInstalledListener: ((details: chrome.runtime.InstalledDetails) => void) | null = null
let onStartupListener: (() => void) | null = null

const chromeMock = {
  runtime: {
    onInstalled: {
      addListener: vi.fn((listener: (details: chrome.runtime.InstalledDetails) => void) => {
        onInstalledListener = listener
      }),
    },
    onStartup: {
      addListener: vi.fn((listener: () => void) => {
        onStartupListener = listener
      }),
    },
  },
}

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('chrome', chromeMock)
  onInstalledListener = null
  onStartupListener = null
  await import('../src/background/service-worker')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('service-worker', () => {
  it('初回インストール時だけ初期同期を実行する', () => {
    onInstalledListener?.({ reason: 'install' })
    onInstalledListener?.({ reason: 'update', previousVersion: '0.1.0' })

    expect(mocks.initializeStorageFromBrowser).toHaveBeenCalledTimes(1)
  })

  it('ブラウザ起動時はタブ再接続モードで初期同期を実行する', () => {
    onStartupListener?.()

    expect(mocks.initializeStorageFromBrowser).toHaveBeenCalledWith({
      reconnectExistingTabs: true,
    })
  })
})
