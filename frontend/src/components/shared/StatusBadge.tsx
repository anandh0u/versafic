export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'mint' | 'amber' | 'rose' | 'sky';
}) {
  const toneClass =
    tone === 'mint'
      ? 'bg-emerald-400/12 text-emerald-200 ring-emerald-400/25'
      : tone === 'amber'
        ? 'bg-amber-400/12 text-amber-100 ring-amber-400/25'
        : tone === 'rose'
          ? 'bg-rose-400/12 text-rose-100 ring-rose-400/25'
          : tone === 'sky'
            ? 'bg-sky-400/12 text-sky-100 ring-sky-400/25'
            : 'bg-white/8 text-slate-200 ring-white/15';

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneClass}`}>{label}</span>;
}
