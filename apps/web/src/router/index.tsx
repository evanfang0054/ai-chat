import { Navigate, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/login/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { AdminPage } from '../pages/admin/AdminPage';
import { ChatPage } from '../pages/chat/ChatPage';
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
      { path: 'dashboard', element: <DashboardPage /> }
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
