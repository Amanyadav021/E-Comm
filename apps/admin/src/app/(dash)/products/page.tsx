'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { useToast } from '@/components/providers';
import {
  Button, Card, ConfirmModal, EmptyRow, Pagination, SearchInput, Select, Spinner, StatusBadge, Td, Th,
} from '@/components/ui';

export default function ProductsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [stock, setStock] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (stock) params.set('stock', stock);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', params.toString()],
    queryFn: () => api.get<any>(`/admin/catalog/products?${params}`),
    placeholderData: keepPreviousData,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-products'] });

  const toggleStatus = async (p: any) => {
    try {
      await api.patch(`/admin/catalog/products/${p.id}/status`, {
        status: p.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE',
      });
      refresh();
      toast('success', p.status === 'ACTIVE' ? 'Product unpublished' : 'Product published');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Failed to update status');
    }
  };

  const duplicate = async (id: string) => {
    try {
      await api.post(`/admin/catalog/products/${id}/duplicate`);
      refresh();
      toast('success', 'Product duplicated as draft');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Failed to duplicate');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/admin/catalog/products/${deleting.id}`);
      refresh();
      toast('info', 'Product deleted');
      setDeleting(null);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Products</h1>
        <Link href="/products/new">
          <Button><Plus className="size-4" /> Add product</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="min-w-52 flex-1">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, SKU…" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status filter" className="w-36">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
        <Select value={stock} onChange={(e) => { setStock(e.target.value); setPage(1); }} aria-label="Stock filter" className="w-36">
          <option value="">All stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead className="border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <Th>Product</Th>
                    <Th>Category</Th>
                    <Th>Price</Th>
                    <Th>Stock</Th>
                    <Th>Sold</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {data?.items.length === 0 && <EmptyRow span={7} text="No products match your filters." />}
                  {data?.items.map((p: any) => (
                    <tr key={p.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                      <Td>
                        <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                          {p.image ? (
                            <img src={p.image} alt="" className="size-10 rounded-lg object-cover" />
                          ) : (
                            <div className="size-10 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                          )}
                          <div className="min-w-0">
                            <p className="max-w-56 truncate font-medium hover:text-brand-600">{p.name}</p>
                            <p className="text-xs text-zinc-400">{p.sku} · {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}</p>
                          </div>
                        </Link>
                      </Td>
                      <Td className="text-zinc-500">{p.category}</Td>
                      <Td>
                        <span className="font-semibold">{formatINR(p.minPrice)}</span>
                        {p.discountPct > 0 && <span className="ml-1 text-xs text-emerald-600">-{p.discountPct}%</span>}
                      </Td>
                      <Td>
                        {p.outOfStock ? (
                          <StatusBadge status="OUT" labels={{ OUT: 'Out of stock' }} />
                        ) : p.lowStock ? (
                          <span className="font-semibold text-amber-600">{p.totalStock} (low)</span>
                        ) : (
                          p.totalStock
                        )}
                      </Td>
                      <Td className="text-zinc-500">{p.soldCount}</Td>
                      <Td>
                        <button onClick={() => toggleStatus(p)} title="Toggle publish">
                          <StatusBadge status={p.status} />
                        </button>
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/products/${p.id}`} aria-label="Edit" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600 dark:hover:bg-zinc-800">
                            <Pencil className="size-4" />
                          </Link>
                          <button onClick={() => duplicate(p.id)} aria-label="Duplicate" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600 dark:hover:bg-zinc-800">
                            <Copy className="size-4" />
                          </button>
                          <button onClick={() => setDeleting({ id: p.id, name: p.name })} aria-label="Delete" className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && <Pagination page={page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
          </>
        )}
      </Card>

      {deleting && (
        <ConfirmModal
          title="Delete product"
          text={`"${deleting.name}" will be archived and removed from the store. Existing orders keep their history. Continue?`}
          confirmLabel="Delete"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
