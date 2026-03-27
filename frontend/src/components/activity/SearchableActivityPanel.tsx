import { useDeferredValue, useState } from 'react';
import { Search } from 'lucide-react';
import type { BillingTransaction } from '../../types';
import { Panel } from '../shared/Panel';
import { UsageHistoryTable } from '../shared/UsageHistoryTable';

const matchesQuery = (item: BillingTransaction, query: string): boolean => {
  if (!query) {
    return true;
  }

  const haystack = [
    item.sourceLabel,
    item.description,
    item.referenceId,
    item.status,
    item.source,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
};

export function SearchableActivityPanel({
  title,
  subtitle,
  items,
  placeholder,
  emptyTitle,
  emptyCopy,
}: {
  title: string;
  subtitle: string;
  items: BillingTransaction[];
  placeholder: string;
  emptyTitle: string;
  emptyCopy: string;
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filteredItems = items.filter((item) => matchesQuery(item, deferredQuery));

  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-300 lg:min-w-[360px]">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
          />
        </label>

        <div className="text-sm text-slate-400">
          Showing <span className="font-semibold text-white">{filteredItems.length}</span> of{' '}
          <span className="font-semibold text-white">{items.length}</span> items
        </div>
      </div>

      <UsageHistoryTable
        items={filteredItems}
        emptyTitle={emptyTitle}
        emptyCopy={query.trim() ? 'No matching activity found for this search yet.' : emptyCopy}
      />
    </Panel>
  );
}
