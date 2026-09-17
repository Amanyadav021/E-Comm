'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { useToast } from '@/components/providers';
import { Button, Card, Input, Modal, Spinner, StatusBadge, Textarea, Toggle } from '@/components/ui';

const EMPTY = {
  name: '', fee: '', freeAbove: '', minDeliveryDays: '3', maxDeliveryDays: '7',
  codAvailable: true, isDefault: false, isActive: true, pincodes: '',
};

export default function ShippingPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: zones, isLoading } = useQuery({
    queryKey: ['admin-zones'],
    queryFn: () => api.get<any[]>('/admin/shipping/zones'),
  });

  const save = async () => {
    setBusy(true);
    try {
      const z = editing;
      const payload = {
        name: z.name,
        fee: Number(z.fee) || 0,
        freeAbove: z.freeAbove ? Number(z.freeAbove) : null,
        minDeliveryDays: Number(z.minDeliveryDays) || 1,
        maxDeliveryDays: Number(z.maxDeliveryDays) || 7,
        codAvailable: z.codAvailable,
        isDefault: z.isDefault,
        isActive: z.isActive,
        pincodes: z.pincodes.split(/[\s,]+/).map((p: string) => p.trim()).filter(Boolean),
      };
      if (z.id) await api.put(`/admin/shipping/zones/${z.id}`, payload);
      else await api.post('/admin/shipping/zones', payload);
      qc.invalidateQueries({ queryKey: ['admin-zones'] });
      toast('success', 'Zone saved');
      setEditing(null);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (z: any) => {
    if (!confirm(`Delete zone "${z.name}"?`)) return;
    try {
      await api.delete(`/admin/shipping/zones/${z.id}`);
      qc.invalidateQueries({ queryKey: ['admin-zones'] });
      toast('info', 'Zone deleted');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Shipping zones</h1>
          <p className="text-sm text-zinc-400">
            Pincodes map to zones (use a prefix like <code>56*</code> for ranges). Unmatched pincodes fall back to the default zone.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="size-4" /> Add zone
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(zones ?? []).map((z: any) => (
          <Card key={z.id}>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <Truck className="size-5 text-brand-600" />
                <h2 className="flex-1 font-bold">
                  {z.name}
                  {z.isDefault && <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-900/40">Default</span>}
                </h2>
                <StatusBadge status={z.isActive ? 'ACTIVE' : 'DISABLED'} />
                <button onClick={() => setEditing({ ...z, fee: String(z.fee), freeAbove: z.freeAbove == null ? '' : String(z.freeAbove), minDeliveryDays: String(z.minDeliveryDays), maxDeliveryDays: String(z.maxDeliveryDays), pincodes: z.pincodes.join(', ') })} aria-label="Edit" className="p-1 text-zinc-400 hover:text-brand-600">
                  <Pencil className="size-4" />
                </button>
                {!z.isDefault && (
                  <button onClick={() => remove(z)} aria-label="Delete" className="p-1 text-zinc-400 hover:text-rose-600">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-zinc-400">Delivery fee</dt><dd className="font-semibold">{z.fee === 0 ? 'Free' : formatINR(z.fee)}</dd></div>
                <div><dt className="text-xs text-zinc-400">Free above</dt><dd className="font-semibold">{z.freeAbove == null ? '—' : formatINR(z.freeAbove)}</dd></div>
                <div><dt className="text-xs text-zinc-400">Delivery time</dt><dd className="font-semibold">{z.minDeliveryDays}–{z.maxDeliveryDays} days</dd></div>
                <div><dt className="text-xs text-zinc-400">Cash on Delivery</dt><dd className="font-semibold">{z.codAvailable ? 'Available' : 'Not available'}</dd></div>
              </dl>
              {z.pincodes.length > 0 && (
                <p className="mt-2 line-clamp-2 text-xs text-zinc-400">Pincodes: {z.pincodes.join(', ')}</p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal title={editing.id ? `Edit ${editing.name}` : 'New zone'} onClose={() => setEditing(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Zone name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Input label="Delivery fee ₹" type="number" value={editing.fee} onChange={(e) => setEditing({ ...editing, fee: e.target.value })} />
            <Input label="Free shipping above ₹ (optional)" type="number" value={editing.freeAbove} onChange={(e) => setEditing({ ...editing, freeAbove: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Min days" type="number" value={editing.minDeliveryDays} onChange={(e) => setEditing({ ...editing, minDeliveryDays: e.target.value })} />
              <Input label="Max days" type="number" value={editing.maxDeliveryDays} onChange={(e) => setEditing({ ...editing, maxDeliveryDays: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Pincodes (comma/space separated; use 56* for prefixes; leave empty for the default zone)"
                rows={2}
                value={editing.pincodes}
                onChange={(e) => setEditing({ ...editing, pincodes: e.target.value })}
              />
            </div>
            <div className="space-y-3 sm:col-span-2">
              <Toggle label="Cash on Delivery available" checked={editing.codAvailable} onChange={(v) => setEditing({ ...editing, codAvailable: v })} />
              <Toggle label="Default zone (fallback)" checked={editing.isDefault} onChange={(v) => setEditing({ ...editing, isDefault: v })} />
              <Toggle label="Active" checked={editing.isActive} onChange={(v) => setEditing({ ...editing, isActive: v })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={busy} onClick={save} disabled={!editing.name}>Save zone</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
