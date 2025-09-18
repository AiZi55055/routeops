// src/features/auth/RequireSignIn.tsx
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';

export default function RequireSignIn({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(getAuth(), (u) => {
      setAuthed(!!u);
      setReady(true);
    });
    return off;
  }, []);

  if (!ready) return <div className="p-4">Checking sign-in…</div>;
  if (!authed) return <div className="p-4">Please sign in to continue.</div>;
  return <>{children}</>;
}
