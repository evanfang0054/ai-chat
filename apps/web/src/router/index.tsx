import { Navigate, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/login/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { AdminPage } from '../pages/admin/AdminPage';
import { ChatPage } from '../pages/chat/ChatPage';
import { SchedulesPage } from '../pages/schedules/SchedulesPage';
import { RunsPage } from '../pages/runs/RunsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'schedules', element: <SchedulesPage /> },
      { path: 'runs', element: <RunsPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  },
  {
    path: '/admin',
    element: <ProtectedRoute />,
    children: [
      {
        element: <RoleRoute role="ADMIN" />,
        children: [{ index: true, element: <AdminPage /> }]
      }
    ]
  }
]);
