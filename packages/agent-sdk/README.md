# @suraksha/agent-sdk

Claude-backed agent runtime for SurakshaSaathi. Tiered model routing, prompt caching, tool use, and agent_run persistence.

## Usage

```ts
import { invokeAgent, registerTool } from '@suraksha/agent-sdk';

// 1. Register tools at startup
registerTool({
  name: 'lookup_scheme',
  description: 'Look up a government scheme by slug.',
  inputSchema: z.object({ slug: z.string() }),
  handler: async ({ slug }, ctx) => { /* DB query */ },
});

// 2. Invoke an agent
const result = await invokeAgent({
  def: await getAgent('rejection-classifier', loadFromDb),
  invocation: {
    agentId: 'rejection-classifier',
    tenantId, userId, caseId,
    userMessage: 'Uploaded rejection letter attached.',
    attachments: [{ documentId, kind: 'rejection_letter', ocrText }],
    locale: 'en',
    parentRunId: null,
    extraContext: { policy: {...} },
  },
  persist: async (row) => {
    // insert into agent_run, return new id
    return await db.insert(agentRun).values(row).returning({ id: agentRun.id }).then(r => r[0].id);
  },
});

if (result.needsReview) {
  // Enqueue into review_task — human approves before action ships to regulator
}
```

## Tiered models

- **opus** → high-stakes classifiers + review agents (RejectionClassifier, MisSellingDetector, ReviewAgent)
- **sonnet** → drafters, explainers, scorers (EscalationDrafter, SchemeExplainer, PolicyHealthScorer)
- **haiku** → triage, routing, simple transforms (IntakeAgent, DeadlineWatcher)

See ADR-0005.

## Prompt caching

System prompt + locale hint are marked `cache_control: ephemeral`. User message stays uncached.

## Cost accounting

Every run row carries `costPaise` — accurate INR cost in paise. Update `USD_TO_PAISE` env when FX moves. Pricing model is in `src/pricing.ts`.
