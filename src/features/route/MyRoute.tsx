// src/features/route/MyRoute.tsx
import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

type Stop = {
  jobId: string;
  sequence: number;
  status: 'planned'|'enroute'|'arrived'|'completed'|'skipped';
  eta?: number;
  arrivedAtISO?: string | null;
  completedAtISO?: string | null;
  proofPhotoUrl?: string | null;
  ocrText?: string | null;
};

export default function MyRoute() {
  const [routeId, setRouteId] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // Find today's route for the signed-in messenger
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    const qRoutes = query(
      collection(db, 'routes'),
      where('messengerId', '==', u.uid),
      where('date', '==', todayUTC())
    );
    getDocs(qRoutes).then((snap) => {
      setRouteId(snap.docs[0]?.id ?? null);
    });
  }, []);

  // Stream stops
  useEffect(() => {
    if (!routeId) { setStops([]); return; }
    const qStops = query(
      collection(db, 'routes', routeId, 'stops'),
      orderBy('sequence', 'asc')
    );
    return onSnapshot(qStops, (snap) => {
      setStops(snap.docs.map((d) => d.data() as Stop));
    });
  }, [routeId]);

  const nextStop = useMemo(() => stops.find(s => s.status !== 'completed' && s.status !== 'skipped'), [stops]);

  async function markArrived(jobId: string) {
    if (!routeId) return;
    await updateDoc(doc(db, 'routes', routeId, 'stops', jobId), {
      status: 'arrived',
      arrivedAtISO: new Date().toISOString()
    });
  }

  async function completeWithPhoto(jobId: string, file: File) {
    if (!routeId) return;
    setUploadingFor(jobId);
    try {
      const storage = getStorage();
      const path = `proofs/${routeId}/${jobId}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'routes', routeId, 'stops', jobId), {
        status: 'completed',
        completedAtISO: new Date().toISOString(),
        proofPhotoUrl: url
      });
    } finally {
      setUploadingFor(null);
    }
  }

  if (!auth.currentUser) return <div className="p-4">Please sign in…</div>;
  if (!routeId) return <div className="p-4">No route assigned today.</div>;

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-3">My Route — {todayUTC()}</h1>
      <ol className="space-y-3">
        {stops.map((s) => {
          const isNext = nextStop?.jobId === s.jobId;
          return (
            <li key={s.jobId} className={`p-3 rounded border ${isNext ? 'border-blue-500' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">#{s.sequence} — {s.jobId}</div>
                  <div className="text-sm opacity-70">
                    Status: {s.status}{s.eta ? ` • ETA: ${new Date(s.eta).toLocaleTimeString()}` : ''}
                  </div>
                  {s.ocrText && <div className="text-xs mt-1 italic">OCR: {s.ocrText}</div>}
                  {s.proofPhotoUrl && <a className="text-blue-600 text-sm" href={s.proofPhotoUrl} target="_blank" rel="noreferrer">View proof</a>}
                </div>
                <div className="flex items-center gap-2">
                  {(s.status === 'planned' || s.status === 'enroute') && (
                    <button className="px-3 py-1 rounded bg-amber-500 text-white" onClick={() => markArrived(s.jobId)}>
                      Arrived
                    </button>
                  )}
                  {s.status !== 'completed' && (
                    <label className="px-3 py-1 rounded bg-green-600 text-white cursor-pointer">
                      {uploadingFor === s.jobId ? 'Uploading…' : 'Complete + Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) completeWithPhoto(s.jobId, file);
                        }}
                        disabled={uploadingFor === s.jobId}
                      />
                    </label>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
