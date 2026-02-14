import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { alerts } from './alerts.js'

export const alertTriggers = pgTable('alert_triggers', {
  id: uuid('id').defaultRandom().primaryKey(),
  alertId: uuid('alert_id')
    .notNull()
    .references(() => alerts.id, { onDelete: 'cascade' }),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  priceAtTrigger: text('price_at_trigger').notNull(),
  message: text('message'),
})
