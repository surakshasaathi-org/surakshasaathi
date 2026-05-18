'use client';

import { createContext, useCallback, useContext, useId, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * Lightweight ARIA-correct tabs primitive — no Radix dep.
 *
 * Controlled-only (parent owns `value` + `onChange`). The parent is expected
 * to derive `value` from a URL search param so tab state is refresh-stable
 * and shareable. See report-shell for the standard wiring.
 *
 * Tab nav is a horizontally-scrollable pill row on mobile; sits naturally on
 * desktop. Per-tab `count` badges (e.g. red-flag count) are supported.
 *
 * Print: tab nav is hidden, every panel is forced visible so customers can
 * save / print the full report. See `report.css` for the @media rules.
 */

interface TabsContextValue {
  value: string;
  onChange: (next: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Tabs>`);
  return ctx;
}

interface TabsProps {
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, onChange, children, className }: TabsProps) {
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value, onChange, baseId }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
}

export function TabList({ children, ariaLabel, className }: TabListProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-tab-nav
      className={cn(
        'flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none px-1 py-1.5',
        className,
      )}
      style={{ scrollbarWidth: 'none' }}
    >
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  count?: number;
  countTone?: 'danger' | 'warn' | 'neutral' | 'primary';
  disabled?: boolean;
}

export function Tab({ value, children, count, countTone = 'neutral', disabled }: TabProps) {
  const { value: active, onChange, baseId } = useTabsContext('Tab');
  const isActive = active === value;
  const ref = useRef<HTMLButtonElement>(null);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Roving focus across siblings — left/right move focus, home/end jump.
      const list = ref.current?.parentElement;
      if (!list) return;
      const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
      const idx = tabs.indexOf(ref.current!);
      if (idx === -1) return;
      let nextIdx: number | null = null;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = tabs.length - 1;
      if (nextIdx !== null) {
        e.preventDefault();
        const target = tabs[nextIdx]!;
        target.focus();
        target.click();
      }
    },
    [],
  );

  return (
    <button
      ref={ref}
      role="tab"
      type="button"
      id={`${baseId}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => onChange(value)}
      onKeyDown={handleKey}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isActive
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-ink-muted hover:border-primary/40 hover:text-ink',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span>{children}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={cn(
            'inline-flex min-w-[1.4rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-5',
            isActive
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : countTone === 'danger'
                ? 'bg-danger/15 text-danger'
                : countTone === 'warn'
                  ? 'bg-warn/15 text-warn'
                  : countTone === 'primary'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-ink/10 text-ink',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className }: TabPanelProps) {
  const { value: active, baseId } = useTabsContext('TabPanel');
  const isActive = active === value;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      data-tab-panel
      data-tab-active={isActive ? 'true' : 'false'}
      hidden={!isActive}
      className={cn(className)}
    >
      {children}
    </div>
  );
}
