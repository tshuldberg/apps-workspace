import { boolean, jsonb, pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const savedScreeners = pgTable(
  'saved_screeners',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    filters: jsonb('filters').notNull().$type<ScreenerFilterSet>(),
    isTemplate: boolean('is_template').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('saved_screeners_user_id_idx').on(table.userId),
    index('saved_screeners_is_template_idx').on(table.isTemplate),
  ],
)

/** JSON shape stored in the `filters` column */
export interface ScreenerFilter {
  field: string
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between' | 'in'
  value: number | string | number[] | string[]
  category: 'fundamental' | 'technical' | 'price_action'
}

export interface ScreenerFilterSet {
  logic: 'AND' | 'OR'
  filters: ScreenerFilter[]
}
