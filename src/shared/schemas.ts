import { z } from 'zod'

export const tabStateSchema = z.enum(['open', 'discarded', 'closed'])

export const groupColorSchema = z.enum([
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
])

export const tabRecordSchema = z.object({
  recordId: z.string().uuid(),
  tabId: z.int().nullable(),
  url: z.string(),
  title: z.string(),
  firstOpened: z.int().nonnegative(),
  lastRefreshed: z.int().nonnegative(),
  state: tabStateSchema,
  groupId: z.int().nullable(),
  windowId: z.int().nullable(),
})

export const groupRecordSchema = z.object({
  groupId: z.int(),
  title: z.string(),
  color: groupColorSchema,
  createdAt: z.int().nonnegative(),
})
