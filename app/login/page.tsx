'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr('Sign-in failed — check your email and password.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={signIn}>
        <div className="mark">⛺</div>
        <h1>Camp Check-In</h1>
        <p>Sign in with the volunteer account you were given.</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" inputMode="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {err && <p className="login-error">{err}</p>}
      </form>
    </div>
  );
}
