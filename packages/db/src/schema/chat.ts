import { pgTable, text, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { createdAt, tenantIdCol } from './_shared';
import { appUser } from './tenancy';
import { policyAnalysis } from './analyses';

/**
 * Persistent chat history for the Customer Explainer agent. Every turn is
 * stored so users can come back later and continue the same conversation.
 *
 * RLS (see migration 0004): the caller's session_token cookie must match the
 * row, OR the row's user_id must equal auth_user_id(), OR super_admin.
 */
export const chatMessage = pgTable(
  'chat_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => policyAnalysis.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => appUser.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token').notNull(),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system' (CHECK in DB)
    content: text('content').notNull(),
    agentRunId: uuid('agent_run_id'),
    tokenCount: integer('token_count'),
    createdAt,
  },
  (t) => ({
    byAnalysis: index('chat_message_analysis_idx').on(t.analysisId, t.createdAt),
    byUser: index('chat_message_user_idx').on(t.userId, t.createdAt),
  }),
);
