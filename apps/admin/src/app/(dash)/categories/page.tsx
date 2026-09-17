'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/providers';
import { Button, Card, Input, Modal, Select, Spinner, StatusBadge, Toggle } from '@/components/ui';

interface CategoryRow {
  id: string; name: string; slug: string; parentId: string | null; imageUrl: string | null;
  iconName: string | null; sortOrder: number; isActive: boolean; isFeatured: boolean; productCount: number;
}

const EMPTY = { name: '', parentId: '', iconName: '', sortOrder: 0, isActive: true, isFeatured: false };

export default function CategoriesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get<CategoryRow[]>('/admin/catalog/categories'),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-categories'] });

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const payload = {
        name: editing.name,
        parentId: editing.parentId || null,
        iconName: editing.iconName || null,
        sortOrder: Number(editing.sortOrder) || 0,
        isActive: editing.isActive,
        isFeatured: editing.isFeatured,
      };
      if (editing.id) await api.put(`/admin/catalog/categories/${editing.id}`, payload);
      else await api.post('/admin/catalog/categories', payload);
      refresh();
      toast('success', 'Category saved');
      setEditing(null);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: CategoryRow) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await api.delete(`/admin/catalog/categories/${c.id}`);
      refresh();
      toast('info', 'Category deleted');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  if (isLoading) return <Spinner />;

  const roots = (categories ?? []).filter((c) => !c.parentId);
  const childrenOf = (id: string) => (categories ?? []).filter((c) => c.parentId === id);

  const row = (c: CategoryRow, depth: number) => (
    <div key={c.id} className="flex items-center gap-3 border-b border-zinc-50 px-4 py-2.5 last:border-0 dark:border-zinc-800/60">
      <span style={{ width: depth * 24 }} />
      <FolderTree className="size-4 text-zinc-300" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {c.name}
          {c.isFeatured && <span className="ml-2 text-[10px] font-bold uppercase text-brand-600">Featured</span>}
        </p>
        <p className="text-xs text-zinc-400">/{c.slug} · {c.productCount} products</p>
      </div>
      <StatusBadge status={c.isActive ? 'ACTIVE' : 'DISABLED'} />
      <button onClick={() => setEditing({ ...EMPTY, ...c, parentId: c.parentId ?? '', iconName: c.iconName ?? '' })} aria-label="Edit" className="rounded p-1.5 text-zinc-400 hover:text-brand-600">
        <Pencil className="size-4" />
      </button>
      <button onClick={() => remove(c)} aria-label="Delete" className="rounded p-1.5 text-zinc-400 hover:text-rose-600">
        <Trash2 className="size-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Categories</h1>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="size-4" /> Add category
        </Button>
      </div>

      <Card>
        {roots.length === 0 && <p className="p-8 text-center text-sm text-zinc-400">No categories yet.</p>}
        {roots.map((root) => (
          <div key={root.id}>
            {row(root, 0)}
            {childrenOf(root.id).map((child) => row(child, 1))}
          </div>
        ))}
      </Card>

      {editing && (
        <Modal title={editing.id ? 'Edit category' : 'New category'} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <Input label="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Select label="Parent category" value={editing.parentId} onChange={(e) => setEditing({ ...editing, parentId: e.target.value })}>
              <option value="">None (top level)</option>
              {roots.filter((r) => r.id !== editing.id).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
            <Input label="Icon name (lucide)" value={editing.iconName} onChange={(e) => setEditing({ ...editing, iconName: e.target.value })} hint="e.g. smartphone, shirt, home" />
            <Input label="Sort order" type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} />
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
