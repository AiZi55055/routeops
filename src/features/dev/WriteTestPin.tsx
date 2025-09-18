import { getAuth } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { useState } from 'react';

export default function WriteTestPin() {
  const [lat, setLat] = useState(13.7576);
  const [lng, setLng] = useState(100.5032);

  const writePin = async () => {
    const u = getAuth().currentUser;
    if (!u) return alert('Please sign in first.');
    const now = Date.now();
    await set(ref(rtdb, `/locations/${u.uid}`), {
      lat, lng, accuracy: 30, speed: 0,
      ts: now, updatedAt: now, // support both keys
    });
    alert(`Wrote /locations/${u.uid} @ ${lat}, ${lng}`);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <label>Lat <input type="number" step="0.0001" value={lat} onChange={e => setLat(+e.target.value)} /></label>
      <label>Lng <input type="number" step="0.0001" value={lng} onChange={e => setLng(+e.target.value)} /></label>
      <button onClick={writePin} style={{ padding: '6px 10px', background: '#2563eb', color: 'white', borderRadius: 6 }}>
        Write Test Pin
      </button>
    </div>
  );
}
