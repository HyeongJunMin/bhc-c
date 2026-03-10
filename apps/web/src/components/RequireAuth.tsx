import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function RequireAuth() {
  const memberId = useAuthStore((s) => s.memberId);
  if (!memberId) return <Navigate to="/" replace />;
  return <Outlet />;
}
