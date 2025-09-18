import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth} from '@/lib/firebase'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  if (user === undefined) return <div className="p-4">Loading…</div>
  if (!user) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <button className="px-4 py-2 rounded bg-sky-500 text-black">
          Sign in with Google
        </button>
      </div>
    )
  }
  return (
    <>
      <div className="fixed top-2 right-2 text-xs opacity-70">
        {user.email} · <button >Sign out</button>
      </div>
      {children}
    </>
  )
}
