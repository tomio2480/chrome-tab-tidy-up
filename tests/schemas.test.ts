import { describe, expect, it } from 'vitest'
import { groupRecordSchema, tabRecordSchema } from '../src/shared/schemas'

const validTab = {
  recordId: '550e8400-e29b-41d4-a716-446655440000',
  tabId: 1,
  url: 'https://example.com',
  title: 'Example',
  firstOpened: 1_700_000_000_000,
  lastRefreshed: 1_700_000_001_000,
  state: 'open' as const,
  groupId: null,
  windowId: 1,
}

const validGroup = {
  groupId: 10,
  title: 'Work',
  color: 'blue' as const,
  createdAt: 1_700_000_000_000,
}

describe('tabRecordSchema', () => {
  it('有効なタブレコードを受け入れる', () => {
    expect(tabRecordSchema.parse(validTab)).toEqual(validTab)
  })

  it('tabId が null のレコードを受け入れる', () => {
    expect(tabRecordSchema.parse({ ...validTab, tabId: null })).toMatchObject({
      tabId: null,
    })
  })

  it('groupId が null のレコードを受け入れる', () => {
    expect(tabRecordSchema.parse({ ...validTab, groupId: null })).toMatchObject({
      groupId: null,
    })
  })

  it('windowId が null のレコードを受け入れる', () => {
    expect(tabRecordSchema.parse({ ...validTab, windowId: null })).toMatchObject({
      windowId: null,
    })
  })

  it('state が discarded のレコードを受け入れる', () => {
    expect(
      tabRecordSchema.parse({ ...validTab, state: 'discarded' }),
    ).toMatchObject({ state: 'discarded' })
  })

  it('state が closed のレコードを受け入れる', () => {
    expect(
      tabRecordSchema.parse({ ...validTab, state: 'closed', tabId: null }),
    ).toMatchObject({ state: 'closed' })
  })

  it('UUID でない recordId を拒否する', () => {
    expect(() =>
      tabRecordSchema.parse({ ...validTab, recordId: 'not-a-uuid' }),
    ).toThrow()
  })

  it('無効な state を拒否する', () => {
    expect(() =>
      tabRecordSchema.parse({ ...validTab, state: 'unknown' }),
    ).toThrow()
  })

  it('小数のタイムスタンプを拒否する', () => {
    expect(() =>
      tabRecordSchema.parse({ ...validTab, firstOpened: 1.5 }),
    ).toThrow()
  })

  it('負のタイムスタンプを拒否する', () => {
    expect(() =>
      tabRecordSchema.parse({ ...validTab, lastRefreshed: -1 }),
    ).toThrow()
  })

  it('小数の tabId を拒否する', () => {
    expect(() =>
      tabRecordSchema.parse({ ...validTab, tabId: 1.5 }),
    ).toThrow()
  })
})

describe('groupRecordSchema', () => {
  it('有効なグループレコードを受け入れる', () => {
    expect(groupRecordSchema.parse(validGroup)).toEqual(validGroup)
  })

  it('すべての色バリアントを受け入れる', () => {
    const colors = [
      'grey',
      'blue',
      'red',
      'yellow',
      'green',
      'pink',
      'purple',
      'cyan',
      'orange',
    ] as const
    for (const color of colors) {
      expect(
        groupRecordSchema.parse({ ...validGroup, color }),
      ).toMatchObject({ color })
    }
  })

  it('無効な色を拒否する', () => {
    expect(() =>
      groupRecordSchema.parse({ ...validGroup, color: 'black' }),
    ).toThrow()
  })

  it('小数の groupId を拒否する', () => {
    expect(() =>
      groupRecordSchema.parse({ ...validGroup, groupId: 1.5 }),
    ).toThrow()
  })

  it('小数の createdAt を拒否する', () => {
    expect(() =>
      groupRecordSchema.parse({ ...validGroup, createdAt: 1.5 }),
    ).toThrow()
  })

  it('負の createdAt を拒否する', () => {
    expect(() =>
      groupRecordSchema.parse({ ...validGroup, createdAt: -1 }),
    ).toThrow()
  })
})
