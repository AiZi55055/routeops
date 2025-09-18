import { Outlet, Link } from 'react-router-dom';
import UserBadge from '@/features/auth/UserBadge';

export default function AppShell() {
  return (
    <div>
      <header style={{ padding: 12, borderBottom: '1px solid #222', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/messenger">Messenger</Link>
        <Link to="/optimize">Optimize</Link>
        <Link to="/upload-jobs">Upload Jobs</Link>
        <Link to="/dev/checks">Dev Check</Link>
        <Link to="/dev/opt">Dev Optimize</Link> {/* <-- added */}
        <Link to="/dashboard-google">google</Link>
        <UserBadge />
      </header>
      <Outlet />
    </div>
  );
}
