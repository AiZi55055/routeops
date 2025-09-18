import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import AppShell from './shell/AppShell';
import SupervisorDashboardGoogle from '@/pages/SupervisorDashboardGoogle';
import MessengerHome from '@/features/messenger/Home';
import SupervisorDashboard from '@/features/dashboard/SupervisorDashboard';
import OptimizePage from '@/features/optimization/OptimizePage';
import UploadJobs from '@/features/company/UploadJobs';
import DevChecks from '@/features/dev/DevChecks';
import TestOptimize from '@/features/dev/TestOptimize'; // <-- added

function Home() {
  return <div style={{ padding: 16 }}>Home – pick a link above.</div>;
}
function NotFound() {
  return <div style={{ padding: 16 }}>404 Not Found</div>;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <NotFound />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/dashboard', element: <SupervisorDashboard /> },
      { path: '/messenger', element: <MessengerHome /> },
      { path: '/optimize', element: <OptimizePage /> },
      { path: '/upload-jobs', element: <UploadJobs /> },
      { path: '/dev/checks', element: <DevChecks /> },
      { path: '/dev/opt', element: <TestOptimize /> }, // <-- added
      { path: '/dashboard-google', element: <SupervisorDashboardGoogle /> },
      
    ],
  },
]);

export default router;
