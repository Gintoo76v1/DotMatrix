'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      inviteCode: form.get('inviteCode') as string,
      username: form.get('username') as string,
      email: form.get('email') as string,
      password: form.get('password') as string,
      displayName: (form.get('displayName') as string) || undefined,
    };

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registrierung fehlgeschlagen.');
        return;
      }

      router.push('/app');
      router.refresh();
    } catch {
      setError('Netzwerkfehler. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="app-bg" data-anim="aurora">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <div className="auth-container">
        <div className="glass-panel auth-panel">
          <div className="auth-logo">DotMatrix Studio</div>

          {error && (
            <div className="auth-error" style={{ display: 'block' }}>
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="inviteCode">Invite Code</label>
              <input
                type="text"
                id="inviteCode"
                name="inviteCode"
                className="text-input"
                placeholder="XXXX-XXXX-XXXX"
                required
                autoComplete="off"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                className="text-input"
                required
                autoComplete="username"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                className="text-input"
                required
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Passwort</label>
              <input
                type="password"
                id="password"
                name="password"
                className="text-input"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="btn primary"
              style={{ marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? 'Registrieren...' : 'Registrieren'}
            </button>
          </form>

          <div className="auth-footer">
            Bereits einen Account? <a href="/login">Hier anmelden</a>
          </div>
        </div>
      </div>

      <style>{`
        .auth-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .auth-panel { width: 100%; max-width: 400px; padding: 40px 30px; display: flex; flex-direction: column; gap: 24px; }
        .auth-logo { font-size: 24px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--dm-primary); text-align: center; margin-bottom: 8px; text-shadow: 0 0 16px var(--dm-primary-soft), 0 0 32px var(--dm-primary-soft); }
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .auth-field { display: flex; flex-direction: column; gap: 8px; }
        .auth-field label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--dm-text-weak); font-weight: 600; }
        .auth-error { color: var(--dm-error); font-size: 13px; text-align: center; }
        .auth-footer { text-align: center; font-size: 13px; color: var(--dm-text-weak); margin-top: 16px; }
        .auth-footer a { color: var(--dm-primary); text-decoration: none; font-weight: 600; }
        .auth-footer a:hover { text-decoration: underline; }
      `}</style>
    </>
  );
}
