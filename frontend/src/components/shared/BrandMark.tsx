import { Bot, Orbit } from 'lucide-react';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-badge">
        <Orbit className="h-5 w-5" />
        <Bot className="h-4 w-4" />
      </div>
      <div>
        <div className={`font-semibold tracking-tight text-white ${compact ? 'text-lg' : 'text-xl'}`}>Versafic</div>
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">AI support control room</div>
      </div>
    </div>
  );
}
