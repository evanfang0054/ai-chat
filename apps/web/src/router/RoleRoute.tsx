import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

export function RoleRoute({ role }: { role: 'ADMIN' | 'USER' }) {
  const user = useAuthStore((state) => state.user);
  return user?.role === role ? <Outlet /> : <Navigate to="/" replace />;
}
