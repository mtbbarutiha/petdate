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
