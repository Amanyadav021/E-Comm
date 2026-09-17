'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Star, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/providers';
import { Button, Card, Input, Select, Textarea, Toggle } from '@/components/ui';

interface VariantForm {
  id?: string;
  sku: string;
  options: Record<string, string>;
  mrp: string;
  price: string;
  costPrice: string;
  stockOnHand: string;
  lowStockThreshold: string;
  isDefault: boolean;
  isActive: boolean;
}

interface SpecItem { label: string; value: string }

const emptyVariant = (): VariantForm => ({
  sku: '', options: {}, mrp: '', price: '', costPrice: '', stockOnHand: '0', lowStockThreshold: '5', isDefault: false, isActive: true,
});

export function ProductEditor({ productId }: { productId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get<any[]>('/admin/catalog/categories'),
  });
  const { data: brands } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => api.get<any[]>('/admin/catalog/brands'),
  });
  const { data: existing, isLoading } = useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => api.get<any>(`/admin/catalog/products/${productId}`),
    enabled: !!productId,
  });

  const [form, setForm] = useState<any>(null);
  const [variants, setVariants] = useState<VariantForm[]>([{ ...emptyVariant(), isDefault: true }]);
  const [optionTypes, setOptionTypes] = useState<string[]>([]);
  const [specs, setSpecs] = useState<SpecItem[]>([]);
  const [features, setFeatures] = useState('');
  const [images, setImages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // hydrate once when editing
  if (productId && existing && form === null) {
    setForm({
      name: existing.name, sku: existing.sku, categoryId: existing.categoryId, brandId: existing.brandId ?? '',
      shortDescription: existing.shortDescription ?? '', description: existing.description,
      taxRatePct: String(existing.taxRatePct), returnWindowDays: String(existing.returnWindowDays),
      warranty: existing.warranty ?? '', returnPolicy: existing.returnPolicy ?? '',
      isReturnable: existing.isReturnable, codAvailable: existing.codAvailable,
      status: existing.status, isFeatured: existing.isFeatured,
      seoTitle: existing.seoTitle ?? '', seoDescription: existing.seoDescription ?? '', seoKeywords: existing.seoKeywords ?? '',
    });
    setOptionTypes(existing.optionTypes ?? []);
    setSpecs((existing.specifications?.[0]?.items as SpecItem[]) ?? []);
    setFeatures((existing.features ?? []).join('\n'));
    setVariants(
      existing.variants.map((v: any) => ({
        id: v.id, sku: v.sku, options: v.options ?? {},
        mrp: String(v.mrp), price: String(v.price), costPrice: v.costPrice == null ? '' : String(v.costPrice),
        stockOnHand: String(v.stockOnHand), lowStockThreshold: String(v.lowStockThreshold),
        isDefault: v.isDefault, isActive: v.isActive,
      })),
    );
    setImages(existing.images ?? []);
  }
  if (!productId && form === null) {
    setForm({
      name: '', sku: '', categoryId: '', brandId: '', shortDescription: '', description: '',
      taxRatePct: '18', returnWindowDays: '7', warranty: '', returnPolicy: '',
      isReturnable: true, codAvailable: true, status: 'DRAFT', isFeatured: false,
      seoTitle: '', seoDescription: '', seoKeywords: '',
    });
  }

  if ((productId && isLoading) || form === null) {
    return <div className="py-16 text-center text-sm text-zinc-400">Loading…</div>;
  }

  const set = (key: string) => (e: React.ChangeEvent<any>) => setForm((f: any) => ({ ...f, [key]: e.target.value }));
  const setBool = (key: string) => (v: boolean) => setForm((f: any) => ({ ...f, [key]: v }));

  const setVariant = (i: number, patch: Partial<VariantForm>) =>
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const buildPayload = () => ({
    name: form.name,
    sku: form.sku,
    categoryId: form.categoryId,
    brandId: form.brandId || null,
    description: form.description,
    shortDescription: form.shortDescription || null,
    specifications: specs.filter((s) => s.label && s.value).length
      ? [{ group: 'General', items: specs.filter((s) => s.label && s.value) }]
      : null,
    features: features.split('\n').map((f) => f.trim()).filter(Boolean),
    optionTypes: optionTypes.length ? optionTypes : null,
    warranty: form.warranty || null,
    returnPolicy: form.returnPolicy || null,
    returnWindowDays: Number(form.returnWindowDays) || 7,
    isReturnable: form.isReturnable,
    codAvailable: form.codAvailable,
    taxRatePct: Number(form.taxRatePct) || 18,
    status: form.status,
    isFeatured: form.isFeatured,
    seoTitle: form.seoTitle || null,
    seoDescription: form.seoDescription || null,
    seoKeywords: form.seoKeywords || null,
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: optionTypes.length ? Object.values(v.options).join(' / ') || null : null,
      options: optionTypes.length ? v.options : null,
      mrp: Number(v.mrp),
      price: Number(v.price),
      costPrice: v.costPrice ? Number(v.costPrice) : null,
      stockOnHand: Number(v.stockOnHand) || 0,
      lowStockThreshold: Number(v.lowStockThreshold) || 5,
      isDefault: v.isDefault,
      isActive: v.isActive,
    })),
  });

  const save = async () => {
    setErrors({});
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = productId
        ? await api.put<any>(`/admin/catalog/products/${productId}`, payload)
        : await api.post<any>('/admin/catalog/products', payload);
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-product', productId] });
      toast('success', productId ? 'Product saved' : 'Product created');
      if (!productId) router.replace(`/products/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.issues) setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
        toast('error', err.message);
      } else {
        toast('error', 'Could not save the product');
      }
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    if (!productId) {
      toast('info', 'Save the product first, then add images.');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/uploads/image', { method: 'POST', credentials: 'include', body });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Upload failed');
      const { url } = await res.json();
      const image = await api.post<any>(`/admin/catalog/products/${productId}/images`, { url, alt: form.name });
      setImages((imgs) => [...imgs, image]);
      toast('success', 'Image uploaded');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const persistImageOrder = async (next: any[]) => {
    setImages(next);
    if (!productId) return;
    await api.patch(`/admin/catalog/products/${productId}/images/reorder`, {
      order: next.map((img, i) => ({ id: img.id, sortOrder: i, isPrimary: i === 0 })),
    });
  };

  const moveImage = (i: number, dir: -1 | 1) => {
    const next = [...images];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    void persistImageOrder(next);
  };

  const makePrimary = (i: number) => {
    const next = [images[i], ...images.filter((_, idx) => idx !== i)];
    void persistImageOrder(next);
  };

  const deleteImage = async (img: any) => {
    if (!productId) return;
    await api.delete(`/admin/catalog/products/${productId}/images/${img.id}`);
    setImages((imgs) => imgs.filter((x) => x.id !== img.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{productId ? `Edit: ${existing?.name ?? ''}` : 'New product'}</h1>
        <div className="flex items-center gap-2">
          <Select value={form.status} onChange={set('status')} aria-label="Status" className="w-32">
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Button onClick={save} loading={saving} size="lg">
            {productId ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Basics">
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Input label="Product name" value={form.name} onChange={set('name')} error={errors.name} className="sm:col-span-2" />
              <Input label="SKU" value={form.sku} onChange={set('sku')} error={errors.sku} />
              <Select label="Category" value={form.categoryId} onChange={set('categoryId')} error={errors.categoryId}>
                <option value="">Select category…</option>
                {(categories ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? '— ' : ''}{c.name}
                  </option>
                ))}
              </Select>
              <Select label="Brand" value={form.brandId} onChange={set('brandId')}>
                <option value="">No brand</option>
                {(brands ?? []).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
              <Input label="Short description" value={form.shortDescription} onChange={set('shortDescription')} className="sm:col-span-2" hint="Shown on cards and search results (· separates highlights)" />
              <Textarea label="Full description" rows={5} value={form.description} onChange={set('description')} error={errors.description} className="sm:col-span-2" />
            </div>
          </Card>

          <Card
            title="Variants & pricing"
            actions={
              <div className="flex items-center gap-2">
                <input
                  value={optionTypes.join(', ')}
                  onChange={(e) => setOptionTypes(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  placeholder="Option axes e.g. Size, Color"
                  className="w-48 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-900"
                />
                <Button size="sm" variant="outline" onClick={() => setVariants((vs) => [...vs, emptyVariant()])}>
                  <Plus className="size-3.5" /> Variant
                </Button>
              </div>
            }
          >
            <div className="table-scroll">
              <table>
                <thead className="border-b border-zinc-100 text-[11px] uppercase text-zinc-400 dark:border-zinc-800">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU</th>
                    {optionTypes.map((t) => (
                      <th key={t} className="px-3 py-2 text-left">{t}</th>
                    ))}
                    <th className="px-3 py-2 text-left">MRP ₹</th>
                    <th className="px-3 py-2 text-left">Price ₹</th>
                    <th className="px-3 py-2 text-left">Cost ₹</th>
                    <th className="px-3 py-2 text-left">{'Stock'}</th>
                    <th className="px-3 py-2 text-left">Low @</th>
                    <th className="px-3 py-2 text-left">Default</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {variants.map((v, i) => (
                    <tr key={i} className={clsx(!v.isActive && 'opacity-50')}>
                      <td className="px-3 py-2">
                        <input value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })} className="w-36 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
                      </td>
                      {optionTypes.map((t) => (
                        <td key={t} className="px-3 py-2">
                          <input
                            value={v.options[t] ?? ''}
                            onChange={(e) => setVariant(i, { options: { ...v.options, [t]: e.target.value } })}
                            className="w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <input type="number" value={v.mrp} onChange={(e) => setVariant(i, { mrp: e.target.value })} className="w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} className="w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={v.costPrice} onChange={(e) => setVariant(i, { costPrice: e.target.value })} className="w-20 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
                      </td>
                      <td className="px-3 py-2">
                        {v.id ? (
                          <span className="text-xs text-zinc-400" title="Adjust via Inventory">{v.stockOnHand}</span>
                        ) : (
                          <input type="number" value={v.stockOnHand} onChange={(e) => setVariant(i, { stockOnHand: e.target.value })} className="w-16 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={v.lowStockThreshold} onChange={(e) => setVariant(i, { lowStockThreshold: e.target.value })} className="w-14 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="radio"
                          name="default-variant"
                          checked={v.isDefault}
                          onChange={() => setVariants((vs) => vs.map((x, idx) => ({ ...x, isDefault: idx === i })))}
                          className="accent-brand-600"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setVariants((vs) => (vs.length > 1 ? vs.filter((_, idx) => idx !== i) : vs))}
                          aria-label="Remove variant"
                          className="text-zinc-300 hover:text-rose-600"
                          disabled={variants.length <= 1}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-800">
              Stock for existing variants is changed from the Inventory page (with a full audit trail). Prices keep history automatically.
            </p>
          </Card>

          <Card title="Images">
            <div className="flex flex-wrap gap-3 p-4">
              {images.map((img, i) => (
                <div key={img.id} className="group relative">
                  <img src={img.url} alt="" className={clsx('size-24 rounded-xl border-2 object-cover', i === 0 ? 'border-brand-500' : 'border-transparent')} />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-brand-600 px-1 py-0.5 text-[9px] font-bold text-white">PRIMARY</span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 hidden justify-center gap-0.5 rounded-b-xl bg-zinc-900/70 py-1 group-hover:flex">
                    <button onClick={() => moveImage(i, -1)} aria-label="Move left" className="text-white/80 hover:text-white"><ArrowUp className="size-3.5 -rotate-90" /></button>
                    <button onClick={() => moveImage(i, 1)} aria-label="Move right" className="text-white/80 hover:text-white"><ArrowDown className="size-3.5 -rotate-90" /></button>
                    <button onClick={() => makePrimary(i)} aria-label="Make primary" className="text-white/80 hover:text-amber-400"><Star className="size-3.5" /></button>
                    <button onClick={() => deleteImage(img)} aria-label="Delete image" className="text-white/80 hover:text-rose-400"><X className="size-3.5" /></button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-300 text-xs text-zinc-400 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 dark:border-zinc-600"
              >
                <ImagePlus className="size-6" />
                {uploading ? 'Uploading…' : 'Add image'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = '';
                }}
              />
            </div>
            {!productId && <p className="px-4 pb-3 text-[11px] text-zinc-400">Create the product first to attach images.</p>}
          </Card>

          <Card title="Specifications & features">
            <div className="space-y-3 p-4">
              {specs.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input value={s.label} onChange={(e) => setSpecs((sp) => sp.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" className="w-40 rounded-lg border border-zinc-200 px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                  <input value={s.value} onChange={(e) => setSpecs((sp) => sp.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))} placeholder="Value" className="flex-1 rounded-lg border border-zinc-200 px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                  <button onClick={() => setSpecs((sp) => sp.filter((_, idx) => idx !== i))} aria-label="Remove spec" className="text-zinc-300 hover:text-rose-600">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setSpecs((sp) => [...sp, { label: '', value: '' }])}>
                <Plus className="size-3.5" /> Add specification
              </Button>
              <Textarea label="Feature bullets (one per line)" rows={3} value={features} onChange={(e) => setFeatures(e.target.value)} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Publishing">
            <div className="space-y-3 p-4">
              <Toggle label="Featured product" checked={form.isFeatured} onChange={setBool('isFeatured')} />
              <Toggle label="Cash on Delivery allowed" checked={form.codAvailable} onChange={setBool('codAvailable')} />
              <Toggle label="Returnable" checked={form.isReturnable} onChange={setBool('isReturnable')} />
              <Input label="Return window (days)" type="number" value={form.returnWindowDays} onChange={set('returnWindowDays')} />
              <Input label="GST rate %" type="number" value={form.taxRatePct} onChange={set('taxRatePct')} hint="Prices entered are GST-inclusive" />
            </div>
          </Card>
          <Card title="Warranty & returns">
            <div className="space-y-3 p-4">
              <Input label="Warranty" value={form.warranty} onChange={set('warranty')} placeholder="e.g. 1 year manufacturer warranty" />
              <Input label="Return policy" value={form.returnPolicy} onChange={set('returnPolicy')} placeholder="e.g. 7-day easy returns" />
            </div>
          </Card>
          <Card title="SEO">
            <div className="space-y-3 p-4">
              <Input label="SEO title" value={form.seoTitle} onChange={set('seoTitle')} />
              <Textarea label="SEO description" rows={2} value={form.seoDescription} onChange={set('seoDescription')} />
              <Input label="Keywords" value={form.seoKeywords} onChange={set('seoKeywords')} hint="Comma-separated" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
