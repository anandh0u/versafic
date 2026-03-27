export function JsonPreview({
  title = 'Latest response',
  data,
  emptyCopy = 'Run an endpoint action to show the response payload here.',
}: {
  title?: string;
  data: unknown;
  emptyCopy?: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/55 p-5">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</div>
      {data ? (
        <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-slate-200">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <div className="mt-4 text-sm leading-6 text-slate-400">{emptyCopy}</div>
      )}
    </div>
  );
}
