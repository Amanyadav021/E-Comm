'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAdmin } from '@/hooks/useAdmin';
import { Button, Input } from '@/components/ui';

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, isStaff, isLoading, setUser } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && user && isStaff) router.replace('/');
  }, [isLoading, user, isStaff, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await api.post<{ user: { id: string; name: string; email: string | null; roles: string[] } }>(
        '/auth/login',
        { email, password },
      );
      if (!data.user.roles.some((r) => r !== 'CUSTOMER')) {
        setError('This account does not have dashboard access.');
        await api.post('/auth/logout');
        return;
      }
      setUser(data.user);
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-brand-600">Shop</span>Craft
          </span>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-zinc-500">
            <ShieldCheck className="size-4" /> Merchant Dashboard
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourstore.com" required autoFocus />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-zinc-400">
          Dev credentials: admin@shopcraft.local / Admin@12345
        </p>
      </div>
    </div>
  );
}
