import type { LucideIcon } from 'lucide-react';

export function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = 'mint',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  tone?: 'mint' | 'amber' | 'rose' | 'sky' | 'violet';
}) {
  const toneMap: Record<string, string> = {
    mint: 'bg-emerald-400/12 text-emerald-200 shadow-[0_18px_40px_-26px_rgba(52,211,153,0.85)]',
    amber: 'bg-amber-400/12 text-amber-100 shadow-[0_18px_40px_-26px_rgba(251,191,36,0.7)]',
    rose: 'bg-rose-400/12 text-rose-100 shadow-[0_18px_40px_-26px_rgba(251,113,133,0.7)]',
    sky: 'bg-sky-400/12 text-sky-100 shadow-[0_18px_40px_-26px_rgba(56,189,248,0.75)]',
    violet: 'bg-violet-400/12 text-violet-100 shadow-[0_18px_40px_-26px_rgba(167,139,250,0.7)]',
  };

  return (
    <div className="data-card">
      <div className={`inline-flex rounded-2xl p-3 ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-5 text-sm font-medium text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{helper}</p>
    </div>
  );
}
