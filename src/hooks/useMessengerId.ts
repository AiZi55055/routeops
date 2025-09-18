import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';

export function useMessengerId() {
  const [id, setId] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    return auth.onAuthStateChanged(u => setId(u?.uid ?? null));
  }, []);

  return id; // null when not signed in
}
