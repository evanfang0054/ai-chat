import { FormEvent, useState } from 'react';
import { Button, Input } from '../ui';

type LoginFormProps = {
  onSubmit: (values: { email: string; password: string }) => Promise<void>;
};

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await onSubmit({ email, password });
    } catch {
      setError('Login failed');
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium text-slate-200" htmlFor="email">
          Email
          <Input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-200" htmlFor="password">
          Password
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <Button type="submit">Sign in</Button>
    </form>
  );
}
