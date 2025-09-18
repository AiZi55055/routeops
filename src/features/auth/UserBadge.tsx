// src/features/auth/UserBadge.tsx
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';

export default function UserBadge() {
  const [user, setUser] = useState<ReturnType<typeof getAuth>['currentUser']>(null);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (!user) return <span className="text-sm">Signed out</span>;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span title={user.uid}>{user.email || user.displayName || user.uid}</span>
      <button
        onClick={() => signOut(getAuth())}
        className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
      >
        Sign out
      </button>
    </div>
  );
}
