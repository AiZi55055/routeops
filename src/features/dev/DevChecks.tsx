import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import {
  collection, getDocs, getFirestore, limit, orderBy, query, where
} from 'firebase/firestore';
import { getDatabase, ref, set } from 'firebase/database';
import { runOptimize, seedMockJobs } from '@/lib/functions';

function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export default function DevChecks() {
  const auth = getAuth();
  const db = getFirestore();
  const rtdb = getDatabase();

  const [log, setLog] = useState<string[]>([]);
  const [lat, setLat] = useState(14.5995);
  const [lng, setLng] = useState(120.9842);

  const push = (m: string) => setLog((L) => [m, ...L]);

  const checkSignedIn = async () => {
    const u = auth.currentUser;
    push(u ? `✅ Signed in as ${u.email || u.uid}` : '❌ Not signed in');
    if (u) await u.getIdToken(true); // refresh claims
  };

  const listMessengers = async () => {
    try {
      let snap = await getDocs(query(collection(db, 'messengers'), where('active','==',true)));
      let ms = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      if (ms.length === 0) {
        snap = await getDocs(collection(db, 'messengers')); // fallback
        ms = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        push('ℹ️ No active messengers found, listed ALL messengers instead.');
      }
      if (ms.length === 0) push('❌ No messengers in Firestore.');
      else push(`✅ Messengers: ${ms.map(m => m.id).join(', ')}`);
    } catch (e: any) {
      push(`❌ Messengers read failed: ${e?.message || e}`);
    }
  };

  const listRoutesRecent = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'routes'), orderBy('date','desc'), limit(10)));
      if (snap.empty) push('❌ No routes in recent list.');
      else {
        const first = snap.docs[0].data() as any;
        push(`✅ Recent routes: ${snap.size}. First route date=${first.date}, legs=${(first.legs?.length)||0}`);
        console.log('Recent routes:', snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e: any) {
      push(`❌ Routes read failed: ${e?.message || e}`);
    }
  };

  const writeLivePin = async () => {
    const u = auth.currentUser;
    if (!u) return push('❌ Sign in first.');
    const now = Date.now();
    await set(ref(rtdb, `/locations/${u.uid}`), { lat, lng, accuracy: 30, speed: 0, updatedAt: now, ts: now });
    push(`✅ Wrote RTDB live pin for ${u.uid} @ ${lat.toFixed(4)},${lng.toFixed(4)}`);
  };

  const seedJobs = async () => {
    const u = auth.currentUser;
    if (!u) return push('❌ Sign in first.');
    await seedMockJobs({ messengerId: u.uid, count: 12, center: { lat, lng }, radiusMeters: 3000 });
    push('✅ Seeded 12 mock jobs around the center.');
  };

  const optimizeMe = async () => {
    const u = auth.currentUser;
    if (!u) return push('❌ Sign in first.');
    const res: any = await runOptimize({ messengerIds: ['OT6d78GuYranAY5pekPAF36dram1'], date: todayUTC() });
    push(`✅ Optimized: routesCreated=${res?.routesCreated ?? 0}, assignedCount=${res?.assignedCount ?? 0}`);
    console.log('optimize result', res);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-semibold">Dev Checks</h1>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Lat
          <input className="block w-full border rounded px-2 py-1" type="number" step="0.0001"
                 value={lat} onChange={e => setLat(+e.target.value)} />
        </label>
        <label className="text-sm">Lng
          <input className="block w-full border rounded px-2 py-1" type="number" step="0.0001"
                 value={lng} onChange={e => setLng(+e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button className="px-3 py-2 rounded bg-gray-800 text-white" onClick={checkSignedIn}>1) Check Sign-in</button>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={listMessengers}>2) List Messengers</button>
        <button className="px-3 py-2 rounded bg-amber-600 text-white" onClick={writeLivePin}>3) Write Live Pin</button>
        <button className="px-3 py-2 rounded bg-emerald-600 text-white" onClick={seedJobs}>4) Seed Mock Jobs</button>
        <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={optimizeMe}>5) Run Optimizer</button>
        <button className="px-3 py-2 rounded bg-gray-700 text-white" onClick={() => (window.location.href = '/dashboard')}>6) Open Dashboard</button>
      </div>

      <div className="mt-4 p-2 border rounded bg-white">
        <div className="font-medium mb-1">Log</div>
        <ul className="text-sm space-y-1">
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>

      <p className="text-xs opacity-70">
        Expected: after steps 3–5, routes should exist for today and the dashboard will show polylines/stop dots; after step 3, a live pin shows immediately.
      </p>
    </div>
  );
}
