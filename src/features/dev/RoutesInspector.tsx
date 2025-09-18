import { useEffect, useState } from 'react';
import { collection, getDocs, getFirestore, orderBy, query, limit } from 'firebase/firestore';

type Routish = {
  id: string;
  date?: string;
  messengerId?: string;
  legs?: Array<{
    jobId: string;
    sequence: number;
    status: string;
    eta?: number;
    travel?: {
      polyline?: any;
      from?: { lat:number; lng:number };
      to?: { lat:number; lng:number };
      distanceMeters?: number;
      durationSec?: number;
    };
  }>;
  createdAt?: any;
};

export default function RoutesInspector() {
  const [routes, setRoutes] = useState<Routish[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      setErr(null);
      const db = getFirestore();
      const snap = await getDocs(query(collection(db, 'routes'), orderBy('date', 'desc'), limit(5)));
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Routish[];
      setRoutes(arr);
      console.log('RoutesInspector recent routes:', arr);
    } catch (e:any) {
      setErr(e?.message || String(e));
      console.error('RoutesInspector error', e);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, background: '#fff', marginTop: 12 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <strong>Routes Inspector</strong>
        <button onClick={load} style={{ padding:'4px 8px' }}>Reload</button>
      </div>
      {err && <div style={{ color:'#b91c1c', marginTop:8 }}>Error: {err}</div>}
      <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.4 }}>
        {routes.length === 0 ? 'No routes found.' : null}
        {routes.map((r) => (
          <div key={r.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed #ddd' }}>
            <div><b>{r.id}</b> • date: {r.date ?? '(none)'} • messenger: {r.messengerId ?? '(none)'} • legs: {r.legs?.length ?? 0}</div>
            {r.legs?.slice(0,3).map((l) => (
              <div key={l.jobId} style={{ marginLeft: 10 }}>
                #{l.sequence} {l.status} • to=({l.travel?.to?.lat ?? '-'}, {l.travel?.to?.lng ?? '-'})
                {l.travel?.polyline ? ' • poly: yes' : ''}
                {l.travel?.from && l.travel?.to ? ' • from/to: yes' : ''}
              </div>
            ))}
            <details style={{ marginTop: 4 }}>
              <summary>raw</summary>
              <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(r, null, 2)}</pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
