/** Pet-lover reviews fetch — kept light so landing does not pull the full page module. */
export type PetLoverReviewCard = {
  id: number;
  displayHandle: string;
  body: string;
  rating: number;
  photoUrl: string;
  createdAt: string;
};

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export async function fetchPetLoverReviewsFeatured(limit = 4): Promise<PetLoverReviewCard[]> {
  const res = await fetch(`${API_BASE}/api/pet-lover-reviews/featured?limit=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('pet lover reviews featured failed');
  const data = (await res.json()) as { reviews: PetLoverReviewCard[] };
  return data.reviews || [];
}

export async function fetchPetLoverReviewsList(opts?: {
  limit?: number;
  offset?: number;
}): Promise<{ reviews: PetLoverReviewCard[]; total: number }> {
  const params = new URLSearchParams();
  params.set('limit', String(opts?.limit ?? 30));
  if (opts?.offset != null) params.set('offset', String(opts.offset));
  const res = await fetch(`${API_BASE}/api/pet-lover-reviews?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('pet lover reviews list failed');
  const data = (await res.json()) as { reviews: PetLoverReviewCard[]; total?: number };
  return {
    reviews: data.reviews || [],
    total: typeof data.total === 'number' ? data.total : (data.reviews || []).length,
  };
}

export async function submitPetLoverReview(opts: {
  token: string;
  displayHandle: string;
  body: string;
  rating: number;
  photo: File;
}): Promise<{ message: string }> {
  const form = new FormData();
  form.append('displayHandle', opts.displayHandle);
  form.append('body', opts.body);
  form.append('rating', String(opts.rating));
  form.append('photo', opts.photo);
  const res = await fetch(`${API_BASE}/api/pet-lover-reviews`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.token}` },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new Error(data.error || 'ثبت نظر ناموفق بود');
  return { message: data.message || 'نظرت ثبت شد و پس از تأیید ادمین منتشر می‌شود' };
}

export type FantasyPhotoStyleCard = {
  id: string;
  labelFa: string;
  labelEn: string;
  background: string;
  sampleUrl: string;
};

export async function fetchFantasyPhotoStyles(): Promise<{
  styles: FantasyPhotoStyleCard[];
  cost: number;
}> {
  const res = await fetch(`${API_BASE}/api/pet-lover-reviews/styles`, { cache: 'no-store' });
  if (!res.ok) throw new Error('styles failed');
  const data = (await res.json()) as { styles: FantasyPhotoStyleCard[]; cost?: number };
  return { styles: data.styles || [], cost: data.cost ?? 5 };
}

export async function generateFantasyPhoto(opts: {
  token: string;
  styleId: string;
  photo: File;
}): Promise<{ photoUrl: string; coins: number; cost: number; message: string; engine: string }> {
  const form = new FormData();
  form.append('styleId', opts.styleId);
  form.append('photo', opts.photo);
  const res = await fetch(`${API_BASE}/api/pet-lover-reviews/ai-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.token}` },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    photoUrl?: string;
    coins?: number;
    cost?: number;
    engine?: string;
  };
  if (!res.ok || !data.photoUrl) throw new Error(data.error || 'ساخت عکس ناموفق بود');
  return {
    photoUrl: data.photoUrl,
    coins: data.coins ?? 0,
    cost: data.cost ?? 5,
    message: data.message || 'عکس فانتزی آماده است',
    engine: data.engine || 'ai',
  };
}
