import { Play } from 'lucide-react';
import type { SimulationAction } from '../../types';

export function SimulationActionCard({
  action,
  onRun,
  disabled,
}: {
  action: SimulationAction;
  onRun: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 transition duration-200 hover:border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white">{action.label}</div>
          <p className="mt-2 text-sm leading-6 text-slate-400">{action.description}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/55 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Burn</div>
          <div className="mt-2 text-xl font-semibold text-white">{action.credits}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
        <span>{action.quantityLabel}</span>
        <span>{action.outcome}</span>
      </div>

      <button onClick={onRun} disabled={disabled} className="button-secondary mt-5 w-full justify-center">
        <Play className="mr-2 h-4 w-4" />
        Run simulation
      </button>
    </div>
  );
}
