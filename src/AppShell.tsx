import { Link, Outlet, useLocation } from 'react-router-dom'

export default function AppShell() {
  const loc = useLocation()
  const isActive = (path:string) =>
    loc.pathname === path || (path==='/route' && loc.pathname === '/')
  const tab = (path:string) =>
    `py-3 ${isActive(path) ? 'text-sky-400' : 'text-slate-400'}`
  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <main className="flex-1"><Outlet /></main>
      <nav className="sticky bottom-0 border-t border-slate-800 bg-slate-900">
        <div className="grid grid-cols-4 text-center text-sm">
          <Link className={tab('/route')} to="/route">Route</Link>
          <Link className={tab('/scan')} to="/scan">Scan</Link>
          <Link className={tab('/issues')} to="/issues">Issues</Link>
          <Link className={tab('/profile')} to="/profile">Profile</Link>
          <Link to="/upload-jobs">Upload Jobs</Link>
        </div>
      </nav>
    </div>
  )
}
