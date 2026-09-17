'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/providers';
import { Button, Card, Input, Modal, Spinner, StatusBadge, Toggle } from '@/components/ui';

const EMPTY = { name: '', isActive: true, isFeatured: false };

export default function BrandsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: brands, isLoading } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => api.get<any[]>('/admin/catalog/brands'),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-brands'] });

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const payload = { name: editing.name, isActive: editing.isActive, isFeatured: editing.isFeatured };
      if (editing.id) await api.put(`/admin/catalog/brands/${editing.id}`, payload);
      else await api.post('/admin/catalog/brands', payload);
      refresh();
      toast('success', 'Brand saved');
      setEditing(null);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: any) => {
    if (!confirm(`Delete brand "${b.name}"?`)) return;
    try {
      await api.delete(`/admin/catalog/brands/${b.id}`);
      refresh();
      toast('info', 'Brand deleted');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Brands</h1>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="size-4" /> Add brand
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(brands ?? []).map((b: any) => (
          <Card key={b.id}>
            <div className="flex items-center gap-3 p-4">
              {b.logoUrl ? (
                <img src={b.logoUrl} alt="" className="size-11 rounded-full object-cover" />
              ) : (
                <span className="flex size-11 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800"><Tag className="size-5 text-zinc-400" /></span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{b.name}</p>
                <p className="text-xs text-zinc-400">{b.productCount} products</p>
              </div>
              <StatusBadge status={b.isActive ? 'ACTIVE' : 'DISABLED'} />
              <button onClick={() => setEditing({ id: b.id, name: b.name, isActive: b.isActive, isFeatured: b.isFeatured })} aria-label="Edit" className="p-1 text-zinc-400 hover:text-brand-600">
                <Pencil className="size-4" />
              </button>
              <button onClick={() => remove(b)} aria-label="Delete" className="p-1 text-zinc-400 hover:text-rose-600">
                <Trash2 className="size-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit brand' : 'New brand'} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <Input label="Brand name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Toggle label="Active" checked={editing.isActive} onChange={(v) => setEditing({ ...editing, isActive: v })} />
            <Toggle label="Featured on homepage" checked={editing.isFeatured} onChange={(v) => setEditing({ ...editing, isFeatured: v })} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={busy} onClick={save}>Save</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
