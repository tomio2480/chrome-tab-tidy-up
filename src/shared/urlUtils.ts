const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'chrome:', 'chrome-extension:'])

export function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url.trim())
    return SAFE_PROTOCOLS.has(protocol)
  } catch {
    return false
  }
}
