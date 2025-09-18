export default function Legend() {
  const items = [
    { c: '#9ca3af', t: 'Planned' },
    { c: '#3b82f6', t: 'Enroute' },
    { c: '#f59e0b', t: 'Arrived' },
    { c: '#10b981', t: 'Completed' },
    { c: '#ef4444', t: 'Skipped' }
  ];
  return (
    <div className="absolute z-[1000] top-2 left-2 bg-white/95 rounded shadow p-2 text-sm">
      <div className="font-semibold mb-1">Legend</div>
      <div className="space-y-1">
        {items.map(i => (
          <div key={i.t} className="flex items-center gap-2">
            <span style={{ background: i.c, width: 12, height: 12, borderRadius: 2, display: 'inline-block' }} />
            <span>{i.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
