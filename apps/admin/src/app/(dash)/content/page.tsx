'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/providers';
import { Button, Card, Input, Modal, Select, Spinner, StatusBadge, Toggle } from '@/components/ui';

const EMPTY_BANNER = {
  title: '', subtitle: '', imageUrl: '', mobileImageUrl: '', linkUrl: '', placement: 'HERO', sortOrder: 0,
  startsAt: '', endsAt: '', isActive: true,
};

const SECTION_TYPES = [
  'FLASH_DEALS', 'TRENDING', 'NEW_ARRIVALS', 'BEST_SELLERS', 'TOP_RATED',
  'FEATURED_CATEGORIES', 'FEATURED_BRANDS', 'CUSTOM_PRODUCTS', 'RECENTLY_VIEWED',
];

const EMPTY_SECTION = { key: '', title: '', type: 'TRENDING', sortOrder: 0, isActive: true };

function dateInput(v: string | null | undefined): string {
  return v ? new Date(v).toISOString().slice(0, 10) : '';
}

export default function ContentPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'banners' | 'sections'>('banners');
  const [bannerEdit, setBannerEdit] = useState<any | null>(null);
  const [sectionEdit, setSectionEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'imageUrl' | 'mobileImageUrl'>('imageUrl');

  const { data: banners, isLoading: loadingBanners } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => api.get<any[]>('/admin/marketing/banners'),
  });
  const { data: sections, isLoading: loadingSections } = useQuery({
    queryKey: ['admin-sections'],
    queryFn: () => api.get<any[]>('/admin/marketing/home-sections'),
  });

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/uploads/image', { method: 'POST', credentials: 'include', body });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Upload failed');
      const { url } = await res.json();
      setBannerEdit((b: any) => ({ ...b, [uploadTarget]: url }));
      toast('success', 'Image uploaded');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveBanner = async () => {
    setBusy(true);
    try {
      const b = bannerEdit;
      const payload = {
        title: b.title, subtitle: b.subtitle || null, imageUrl: b.imageUrl,
        mobileImageUrl: b.mobileImageUrl || null, linkUrl: b.linkUrl || null,
        placement: b.placement, sortOrder: Number(b.sortOrder) || 0,
        startsAt: b.startsAt || null, endsAt: b.endsAt || null, isActive: b.isActive,
      };
      if (b.id) await api.put(`/admin/marketing/banners/${b.id}`, payload);
      else await api.post('/admin/marketing/banners', payload);
      qc.invalidateQueries({ queryKey: ['admin-banners'] });
      toast('success', 'Banner saved');
      setBannerEdit(null);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveSection = async () => {
    setBusy(true);
    try {
      const s = sectionEdit;
      const payload = {
        key: s.key || s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: s.title, type: s.type, sortOrder: Number(s.sortOrder) || 0, isActive: s.isActive,
      };
      if (s.id) await api.put(`/admin/marketing/home-sections/${s.id}`, payload);
      else await api.post('/admin/marketing/home-sections', payload);
      qc.invalidateQueries({ queryKey: ['admin-sections'] });
      toast('success', 'Section saved');
      setSectionEdit(null);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const moveSection = async (index: number, dir: -1 | 1) => {
    const list = [...(sections ?? [])];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    await Promise.all(
      list.map((s, i) =>
        api.put(`/admin/marketing/home-sections/${s.id}`, {
          key: s.key, title: s.title, type: s.type, sortOrder: i, isActive: s.isActive,
        }),
      ),
    );
    qc.invalidateQueries({ queryKey: ['admin-sections'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Homepage &amp; Banners</h1>
        {tab === 'banners' ? (
          <Button onClick={() => setBannerEdit({ ...EMPTY_BANNER })}><Plus className="size-4" /> New banner</Button>
        ) : (
          <Button onClick={() => setSectionEdit({ ...EMPTY_SECTION })}><Plus className="size-4" /> New section</Button>
        )}
      </div>

      <div className="flex gap-2">
        {(['banners', 'sections'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-semibold capitalize transition',
              tab === t ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:ring-zinc-700',
            )}
          >
            {t === 'banners' ? 'Banners' : 'Homepage sections'}
          </button>
        ))}
      </div>

      {tab === 'banners' &&
        (loadingBanners ? (
          <Spinner />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(banners ?? []).map((b: any) => (
              <Card key={b.id}>
                <img src={b.imageUrl} alt={b.title} className="aspect-[16/6] w-full rounded-t-xl object-cover" />
                <div className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.title}</p>
                    <p className="text-xs text-zinc-400">{b.placement} · order {b.sortOrder}{b.linkUrl ? ` · ${b.linkUrl}` : ''}</p>
                  </div>
                  <StatusBadge status={b.isActive ? 'ACTIVE' : 'DISABLED'} />
                  <button
                    onClick={() => setBannerEdit({ ...b, subtitle: b.subtitle ?? '', mobileImageUrl: b.mobileImageUrl ?? '', linkUrl: b.linkUrl ?? '', startsAt: dateInput(b.startsAt), endsAt: dateInput(b.endsAt) })}
                    aria-label="Edit" className="p-1 text-zinc-400 hover:text-brand-600"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete banner "${b.title}"?`)) return;
                      await api.delete(`/admin/marketing/banners/${b.id}`);
                      qc.invalidateQueries({ queryKey: ['admin-banners'] });
                    }}
                    aria-label="Delete" className="p-1 text-zinc-400 hover:text-rose-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {tab === 'sections' &&
        (loadingSections ? (
          <Spinner />
        ) : (
          <Card>
            {(sections ?? []).map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-zinc-50 px-4 py-3 last:border-0 dark:border-zinc-800/60">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Move up" className="text-zinc-300 hover:text-brand-600 disabled:opacity-30"><ArrowUp className="size-4" /></button>
                  <button onClick={() => moveSection(i, 1)} disabled={i === (sections?.length ?? 0) - 1} aria-label="Move down" className="text-zinc-300 hover:text-brand-600 disabled:opacity-30"><ArrowDown className="size-4" /></button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-xs text-zinc-400">{s.type.replaceAll('_', ' ').toLowerCase()} · key: {s.key}</p>
                </div>
                <StatusBadge status={s.isActive ? 'ACTIVE' : 'DISABLED'} />
                <button onClick={() => setSectionEdit({ ...s })} aria-label="Edit" className="p-1.5 text-zinc-400 hover:text-brand-600"><Pencil className="size-4" /></button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete section "${s.title}"?`)) return;
                    await api.delete(`/admin/marketing/home-sections/${s.id}`);
                    qc.invalidateQueries({ queryKey: ['admin-sections'] });
                  }}
                  aria-label="Delete" className="p-1.5 text-zinc-400 hover:text-rose-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </Card>
        ))}

      {bannerEdit && (
        <Modal title={bannerEdit.id ? 'Edit banner' : 'New banner'} onClose={() => setBannerEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Title" value={bannerEdit.title} onChange={(e) => setBannerEdit({ ...bannerEdit, title: e.target.value })} />
            <Input label="Subtitle" value={bannerEdit.subtitle} onChange={(e) => setBannerEdit({ ...bannerEdit, subtitle: e.target.value })} />
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Images</p>
              <div className="flex flex-wrap items-center gap-3">
                {bannerEdit.imageUrl ? (
                  <img src={bannerEdit.imageUrl} alt="" className="h-20 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-20 w-48 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">Desktop image</div>
                )}
                <Button size="sm" variant="outline" loading={uploading} onClick={() => { setUploadTarget('imageUrl'); fileRef.current?.click(); }}>
                  <ImagePlus className="size-4" /> Desktop
                </Button>
                <Button size="sm" variant="outline" loading={uploading} onClick={() => { setUploadTarget('mobileImageUrl'); fileRef.current?.click(); }}>
                  <ImagePlus className="size-4" /> Mobile
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadImage(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            <Input label="Link URL" value={bannerEdit.linkUrl} onChange={(e) => setBannerEdit({ ...bannerEdit, linkUrl: e.target.value })} placeholder="/category/electronics" />
            <Select label="Placement" value={bannerEdit.placement} onChange={(e) => setBannerEdit({ ...bannerEdit, placement: e.target.value })}>
              <option value="HERO">Hero carousel</option>
              <option value="PROMO">Promo tiles</option>
              <option value="STRIP">Strip</option>
            </Select>
            <Input label="Sort order" type="number" value={bannerEdit.sortOrder} onChange={(e) => setBannerEdit({ ...bannerEdit, sortOrder: e.target.value })} />
            <Input label="Starts (optional)" type="date" value={bannerEdit.startsAt} onChange={(e) => setBannerEdit({ ...bannerEdit, startsAt: e.target.value })} />
            <Input label="Ends (optional)" type="date" value={bannerEdit.endsAt} onChange={(e) => setBannerEdit({ ...bannerEdit, endsAt: e.target.value })} />
            <div className="sm:col-span-2">
              <Toggle label="Active" checked={bannerEdit.isActive} onChange={(v) => setBannerEdit({ ...bannerEdit, isActive: v })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBannerEdit(null)}>Cancel</Button>
            <Button loading={busy} onClick={saveBanner} disabled={!bannerEdit.title || !bannerEdit.imageUrl}>Save banner</Button>
          </div>
        </Modal>
      )}

      {sectionEdit && (
        <Modal title={sectionEdit.id ? 'Edit section' : 'New section'} onClose={() => setSectionEdit(null)}>
          <div className="space-y-3">
            <Input label="Title" value={sectionEdit.title} onChange={(e) => setSectionEdit({ ...sectionEdit, title: e.target.value })} />
            <Select label="Type" value={sectionEdit.type} onChange={(e) => setSectionEdit({ ...sectionEdit, type: e.target.value })}>
              {SECTION_TYPES.map((t) => (
                <option key={t} value={t}>{t.replaceAll('_', ' ').toLowerCase()}</option>
              ))}
            </Select>
            <Toggle label="Active" checked={sectionEdit.isActive} onChange={(v) => setSectionEdit({ ...sectionEdit, isActive: v })} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSectionEdit(null)}>Cancel</Button>
            <Button loading={busy} onClick={saveSection} disabled={!sectionEdit.title}>Save section</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
