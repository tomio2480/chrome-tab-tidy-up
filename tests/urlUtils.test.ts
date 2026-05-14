import { describe, expect, it } from 'vitest'
import { isSafeUrl } from '../src/shared/urlUtils'

describe('isSafeUrl', () => {
  it('https: URL を許可する', () => {
    expect(isSafeUrl('https://example.com')).toBe(true)
  })

  it('http: URL を許可する', () => {
    expect(isSafeUrl('http://example.com')).toBe(true)
  })

  it('chrome: URL を許可する', () => {
    expect(isSafeUrl('chrome://newtab/')).toBe(true)
  })

  it('chrome-extension: URL を許可する', () => {
    expect(isSafeUrl('chrome-extension://abcdef/dashboard.html')).toBe(true)
  })

  it('javascript: スキームを拒否する', () => {
    expect(isSafeUrl('javascript:void(0)')).toBe(false)
  })

  it('大文字の JAVASCRIPT: スキームを拒否する', () => {
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false)
  })

  it('javascript: スキームの空白パディングを拒否する', () => {
    expect(isSafeUrl('  javascript:alert(1)')).toBe(false)
  })

  it('data: スキームを拒否する', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('不正な URL を拒否する', () => {
    expect(isSafeUrl('not a url')).toBe(false)
  })

  it('空文字を拒否する', () => {
    expect(isSafeUrl('')).toBe(false)
  })
})
