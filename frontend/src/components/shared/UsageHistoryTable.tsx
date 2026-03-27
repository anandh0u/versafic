import { ArrowDownLeft, ArrowUpRight, Clock3 } from 'lucide-react';
import type { BillingTransaction } from '../../types';
import { formatDateTime } from '../../lib/formatters';
import { StatusBadge } from './StatusBadge';

export function UsageHistoryTable({
  items,
  emptyTitle,
  emptyCopy,
}: {
  items: BillingTransaction[];
  emptyTitle: string;
  emptyCopy: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-16 text-center">
        <Clock3 className="mb-4 h-10 w-10 text-slate-500" />
        <div className="text-base font-medium text-white">{emptyTitle}</div>
        <div className="mt-2 max-w-md text-sm leading-6 text-slate-400">{emptyCopy}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <div className="hidden grid-cols-[1.2fr_1fr_0.8fr_0.9fr_0.8fr] gap-4 bg-white/[0.04] px-5 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 md:grid">
        <div>Feature</div>
        <div>Timestamp</div>
        <div>Credits</div>
        <div>Reference</div>
        <div>Status</div>
      </div>

      <div className="divide-y divide-white/8">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-4 bg-slate-950/55 px-5 py-5 md:grid-cols-[1.2fr_1fr_0.8fr_0.9fr_0.8fr] md:items-center"
          >
            <div className="flex items-start gap-4">
              <div className={`mt-1 rounded-2xl p-3 ${item.creditsDelta > 0 ? 'bg-emerald-400/12 text-emerald-200' : 'bg-rose-400/12 text-rose-100'}`}>
                {item.creditsDelta > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{item.sourceLabel}</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">{item.description}</div>
              </div>
            </div>
            <div className="text-sm text-slate-300">{formatDateTime(item.createdAt)}</div>
            <div className={`text-base font-semibold ${item.creditsDelta > 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
              {item.creditsDelta > 0 ? '+' : ''}
              {item.creditsDelta}
            </div>
            <div className="text-sm text-slate-400">{item.referenceId || 'No ref'}</div>
            <div>
              <StatusBadge
                label={item.status}
                tone={item.status === 'failed' ? 'rose' : item.status === 'pending' ? 'amber' : 'mint'}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
