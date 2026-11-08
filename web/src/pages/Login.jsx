import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { api, setToken } from '../api.js';
import { Button, Field, ErrorNote } from '../ui.jsx';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { token } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      nav('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-5">
        <span className="size-11 rounded-xl bg-accent flex items-center justify-center"><TrendingUp className="size-5 text-bg" strokeWidth={2.6} /></span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-5xl leading-none">Welcome back.</h1>
          <p className="text-muted text-[15px]">Sign in to your Growth Engine.</p>
        </div>
        <ErrorNote error={error} />
        <Field id="email" label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" variant="primary" size="lg" loading={busy}>Sign in</Button>
      </form>
    </div>
  );
}
