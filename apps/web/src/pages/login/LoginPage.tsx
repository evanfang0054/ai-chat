import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../../components/forms/LoginForm';
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
    <main>
      <h1>Login</h1>
      <LoginForm onSubmit={handleLogin} />
    </main>
  );
}
