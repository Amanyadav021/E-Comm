'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Store, Users } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/providers';
import { Button, Card, Input, Modal, Select, Spinner, StatusBadge, Toggle } from '@/components/ui';

function StoreSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get<Record<string, Record<string, any>>>('/admin/settings'),
  });
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Spinner />;
  if (form === null && settings) {
    setForm({
      'store.name': settings.store?.['store.name'] ?? 'ShopCraft',
      'store.tagline': settings.store?.['store.tagline'] ?? '',
      'store.supportEmail': settings.store?.['store.supportEmail'] ?? '',
      'store.supportPhone': settings.store?.['store.supportPhone'] ?? '',
      'tax.defaultGstRatePct': settings.tax?.['tax.defaultGstRatePct'] ?? 18,
      'tax.gstin': settings.tax?.['tax.gstin'] ?? '',
      'payment.codEnabled': settings.payment?.['payment.codEnabled'] ?? true,
      'notifications.emailEnabled': settings.notifications?.['notifications.emailEnabled'] ?? true,
    });
    return <Spinner />;
  }
  if (!form) return <Spinner />;

  const save = async (group: string, keys: string[]) => {
    setBusy(true);
    try {
      await api.put('/admin/settings', {
        group,
        values: Object.fromEntries(keys.map((k) => [k, form[k]])),
      });
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      toast('success', 'Settings saved');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Store details">
        <div className="space-y-3 p-4">
          <Input label="Store name" value={form['store.name']} onChange={(e) => setForm({ ...form, 'store.name': e.target.value })} />
          <Input label="Tagline" value={form['store.tagline']} onChange={(e) => setForm({ ...form, 'store.tagline': e.target.value })} />
          <Input label="Support email" value={form['store.supportEmail']} onChange={(e) => setForm({ ...form, 'store.supportEmail': e.target.value })} />
          <Input label="Support phone" value={form['store.supportPhone']} onChange={(e) => setForm({ ...form, 'store.supportPhone': e.target.value })} />
          <Button loading={busy} onClick={() => save('store', ['store.name', 'store.tagline', 'store.supportEmail', 'store.supportPhone'])}>
            Save store details
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Tax (GST)">
          <div className="space-y-3 p-4">
            <Input label="Default GST rate %" type="number" value={form['tax.defaultGstRatePct']} onChange={(e) => setForm({ ...form, 'tax.defaultGstRatePct': Number(e.target.value) })} hint="Product prices are entered GST-inclusive; per-product rates override this." />
            <Input label="GSTIN" value={form['tax.gstin']} onChange={(e) => setForm({ ...form, 'tax.gstin': e.target.value })} />
            <Button loading={busy} onClick={() => save('tax', ['tax.defaultGstRatePct', 'tax.gstin'])}>Save tax settings</Button>
          </div>
        </Card>
        <Card title="Payments & notifications">
          <div className="space-y-3 p-4">
            <Toggle label="Cash on Delivery enabled" checked={form['payment.codEnabled']} onChange={(v) => setForm({ ...form, 'payment.codEnabled': v })} />
            <Toggle label="Email notifications" checked={form['notifications.emailEnabled']} onChange={(v) => setForm({ ...form, 'notifications.emailEnabled': v })} />
            <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800">
              Gateway keys, SMTP and SMS credentials are configured via environment variables on the server — never stored in the database or exposed here.
            </p>
            <Button
              loading={busy}
              onClick={async () => {
                await save('payment', ['payment.codEnabled']);
                await save('notifications', ['notifications.emailEnabled']);
              }}
            >
              Save
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StaffSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: staff, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: () => api.get<any[]>('/admin/settings/staff'),
  });
  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get<any>('/admin/settings/roles'),
  });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', roles: ['ADMIN'] as string[] });
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Spinner />;

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/admin/settings/staff', form);
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      toast('success', 'Staff member added');
      setCreating(false);
      setForm({ name: '', email: '', password: '', roles: ['ADMIN'] });
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Could not add staff');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (s: any) => {
    try {
      await api.patch(`/admin/settings/staff/${s.id}`, { status: s.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' });
      qc.invalidateQueries({ queryKey: ['admin-staff'] });
      toast('success', 'Updated');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Update failed');
    }
  };

  const savePerms = async () => {
    setBusy(true);
    try {
      await api.patch(`/admin/settings/roles/${editingRole.name}`, { permissions: editingRole.permissions });
      qc.invalidateQueries({ queryKey: ['admin-roles'] });
      toast('success', 'Role permissions updated');
      setEditingRole(null);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const allRoles = (rolesData?.roles ?? []).map((r: any) => r.name);

  return (
    <div className="space-y-4">
      <Card
        title="Staff accounts"
        actions={<Button size="sm" onClick={() => setCreating(true)}><Plus className="size-4" /> Add staff</Button>}
      >
        <ul className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
          {(staff ?? []).map((s: any) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/40">
                {s.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-xs text-zinc-400">{s.email} · {s.roles.join(', ')}</p>
              </div>
              <StatusBadge status={s.status} />
              <Button size="sm" variant={s.status === 'ACTIVE' ? 'outline' : 'primary'} onClick={() => toggleStatus(s)}>
                {s.status === 'ACTIVE' ? 'Disable' : 'Enable'}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Roles & permissions">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {(rolesData?.roles ?? []).map((r: any) => (
            <button
              key={r.id}
              onClick={() => r.name !== 'SUPER_ADMIN' && setEditingRole({ ...r, permissions: r.permissions === '*' ? [] : [...r.permissions] })}
              disabled={r.name === 'SUPER_ADMIN'}
              className="rounded-xl border border-zinc-200 p-3.5 text-left transition hover:border-brand-300 disabled:cursor-default dark:border-zinc-700"
            >
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <ShieldCheck className="size-4 text-brand-600" /> {r.label}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {r.permissions === '*' ? 'All permissions (fixed)' : `${r.permissions.length} permission${r.permissions.length === 1 ? '' : 's'}`}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {creating && (
        <Modal title="Add staff member" onClose={() => setCreating(false)}>
          <div className="space-y-3">
            <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="Min 8 characters with letters and numbers" />
            <div>
              <p className="mb-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Roles</p>
              <div className="flex flex-wrap gap-2">
                {allRoles.map((r: string) => {
                  const active = form.roles.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => setForm({ ...form, roles: active ? form.roles.filter((x) => x !== r) : [...form.roles, r] })}
                      className={clsx(
                        'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                        active ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                      )}
                    >
                      {r.replaceAll('_', ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button loading={busy} onClick={create} disabled={!form.name || !form.email || !form.password || form.roles.length === 0}>
              Create account
            </Button>
          </div>
        </Modal>
      )}

      {editingRole && (
        <Modal title={`Permissions — ${editingRole.label}`} onClose={() => setEditingRole(null)} wide>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(rolesData?.permissions ?? []).map((p: string) => {
              const active = editingRole.permissions.includes(p);
              return (
                <button
                  key={p}
                  onClick={() =>
                    setEditingRole({
                      ...editingRole,
                      permissions: active
                        ? editingRole.permissions.filter((x: string) => x !== p)
                        : [...editingRole.permissions, p],
                    })
                  }
                  className={clsx(
                    'rounded-lg px-2.5 py-2 text-left text-xs font-medium transition',
                    active ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingRole(null)}>Cancel</Button>
            <Button loading={busy} onClick={savePerms}>Save permissions</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'store' | 'staff'>('store');
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <div className="flex gap-2">
        <button
          onClick={() => setTab('store')}
          className={clsx('flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition', tab === 'store' ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700')}
        >
          <Store className="size-4" /> Store
        </button>
        <button
          onClick={() => setTab('staff')}
          className={clsx('flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition', tab === 'staff' ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700')}
        >
          <Users className="size-4" /> Staff & roles
        </button>
      </div>
      {tab === 'store' ? <StoreSettings /> : <StaffSettings />}
    </div>
  );
}
