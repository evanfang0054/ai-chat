import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../../components/forms/LoginForm';
import { Card } from '../../components/ui';
import { login } from '../../services/auth';
import { useAuthStore } from '../../stores/auth-store';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  async function handleLogin(values: { email: string; password: string }) {
    const response = await login(values);
    setAuth(response);
    navigate('/');
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-md">
        <Card className="space-y-4 p-6">
          <h1 className="text-2xl font-semibold">Login</h1>
          <LoginForm onSubmit={handleLogin} />
        </Card>
      </div>
    </main>
  );
}
