import Link from 'next/link';
import { ArrowRight, Workflow, MessageCircle, Clock, Hand } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import type { FlowLane, FlowLaneKind, ProductFlow } from '@/lib/product-flows';

interface AgentMeta {
  slug: string;
  displayName: string;
  modelTier: string;
  enabled: boolean;
}

interface Props {
  flow: ProductFlow;
  agents: AgentMeta[];
}

const LANE_ICON: Record<FlowLaneKind, React.ReactNode> = {
  pipeline: <Workflow className="size-3.5" />,
  on_demand: <MessageCircle className="size-3.5" />,
  scheduled: <Clock className="size-3.5" />,
  manual: <Hand className="size-3.5" />,
};

const TIER_TONE: Record<string, 'primary' | 'success' | 'warn' | 'neutral'> = {
  opus: 'warn',
  sonnet: 'primary',
  haiku: 'success',
};

export function AgentFlow({ flow, agents }: Props) {
  const byslug = new Map(agents.map((a) => [a.slug, a]));

  return (
    <div className="space-y-5">
      {flow.lanes.map((lane, i) => (
        <Lane key={i} lane={lane} byslug={byslug} />
      ))}
      <Legend />
    </div>
  );
}

function Lane({ lane, byslug }: { lane: FlowLane; byslug: Map<string, AgentMeta> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
          {LANE_ICON[lane.kind]}
          {lane.kind.replace('_', '-')}
        </span>
        <h3 className="font-display text-sm font-semibold text-ink">{lane.title}</h3>
      </div>
      {lane.description && (
        <p className="mb-4 max-w-prose text-xs text-ink-muted">{lane.description}</p>
      )}
      <ol className="flex flex-wrap items-stretch gap-x-1 gap-y-3">
        {lane.steps.map((step, idx) => {
          const agent = byslug.get(step.agentSlug);
          return (
            <li key={idx} className="flex items-stretch gap-1">
              {idx > 0 && (
                <div className="flex flex-col items-center justify-center px-1 text-ink-subtle">
                  <ArrowRight className="size-4" />
                  {step.edgeLabel && (
                    <span className="mt-0.5 max-w-[88px] text-center text-[10px] leading-tight text-ink-subtle">
                      {step.edgeLabel}
                    </span>
                  )}
                </div>
              )}
              <StepCard step={step} agent={agent} index={idx + 1} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepCard({
  step,
  agent,
  index,
}: {
  step: { agentSlug: string; note?: string; optional?: boolean };
  agent: AgentMeta | undefined;
  index: number;
}) {
  const tier = agent?.modelTier ?? 'unknown';
  const tone = TIER_TONE[tier] ?? 'neutral';
  const missing = !agent;
  const disabled = agent && !agent.enabled;

  const card = (
    <div
      className={[
        'flex h-full w-44 flex-col gap-1.5 rounded-lg border bg-background p-3 transition',
        step.optional ? 'border-dashed' : 'border-solid',
        missing
          ? 'border-danger/40 bg-danger/5'
          : disabled
            ? 'border-border opacity-60'
            : 'border-border hover:border-primary/40',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          step {index}
        </span>
        <Badge tone={tone}>{tier}</Badge>
      </div>
      <div className="font-medium text-ink text-sm leading-tight">
        {agent?.displayName ?? step.agentSlug}
      </div>
      <div className="font-mono text-[10px] text-ink-muted">{step.agentSlug}</div>
      {step.note && (
        <div className="mt-1 text-[11px] leading-snug text-ink-muted">
          {step.note}
          {step.optional && <span className="text-ink-subtle"> · (optional)</span>}
        </div>
      )}
      {missing && (
        <div className="mt-1 text-[11px] font-medium text-danger">
          not in module roster
        </div>
      )}
      {disabled && (
        <div className="mt-1 text-[11px] font-medium text-ink-subtle">disabled</div>
      )}
    </div>
  );

  return agent ? (
    <Link href={`/agents/${step.agentSlug}`} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-subtle">
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="warn">opus</Badge>
        highest reasoning
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="primary">sonnet</Badge>
        balanced
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="success">haiku</Badge>
        cheap gate
      </span>
      <span>· dashed border = optional step</span>
      <span>· red card = listed in flow but not in module agent roster</span>
    </div>
  );
}
