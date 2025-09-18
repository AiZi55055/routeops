import React, { useState } from 'react';
import { seedMockJobs } from '@/lib/functions';
import { getAuth } from 'firebase/auth';

export default function UploadJobs() {
  const auth = getAuth();
  const uid = auth.currentUser?.uid || '';
  const [count, setCount] = useState(12);
  const [lat, setLat] = useState(14.5995);
  const [lng, setLng] = useState(120.9842);
  const [radius, setRadius] = useState(3000);
  const [busy, setBusy] = useState(false);

  const runSeed = async () => {
    if (!uid) {
      alert('Sign in to seed jobs.');
      return;
    }
    setBusy(true);
    try {
      await seedMockJobs({
        messengerId: uid,
        count,
        center: { lat, lng },
        radiusMeters: radius,
      });
      alert(`Seeded ${count} jobs near ${lat}, ${lng}`);
    } catch (e: any) {
      console.error(e);
      alert(`Seed failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-3">
      <h1 className="text-xl font-semibold">Upload / Seed Jobs</h1>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Lat
          <input className="block w-full border rounded px-2 py-1"
                 type="number" step="0.0001" value={lat}
                 onChange={(e) => setLat(+e.target.value)} />
        </label>
        <label className="text-sm">
          Lng
          <input className="block w-full border rounded px-2 py-1"
                 type="number" step="0.0001" value={lng}
                 onChange={(e) => setLng(+e.target.value)} />
        </label>
        <label className="text-sm">
          Count
          <input className="block w-full border rounded px-2 py-1"
                 type="number" min={1} max={100} value={count}
                 onChange={(e) => setCount(+e.target.value)} />
        </label>
        <label className="text-sm">
          Radius (m)
          <input className="block w-full border rounded px-2 py-1"
                 type="number" min={100} max={20000} value={radius}
                 onChange={(e) => setRadius(+e.target.value)} />
        </label>
      </div>

      <button
        onClick={runSeed}
        disabled={busy}
        className="px-3 py-2 rounded bg-amber-600 text-white disabled:opacity-60"
      >
        {busy ? 'Seeding…' : 'Seed Mock Jobs'}
      </button>
    </div>
  );
}
