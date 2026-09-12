/** Magazine list/featured fetch — kept off MagazinePage so the landing chunk
 *  does not pull the magazine UI module (and its chrome) into the homepage graph. */
export type MagazineCard = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  author: string;
  publishAt: string;
  featured?: boolean;
};

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export async function fetchMagazineList(opts?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ articles: MagazineCard[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.q) params.set('q', opts.q);
  params.set('limit', String(opts?.limit ?? 24));
  if (opts?.offset != null) params.set('offset', String(opts.offset));
  const res = await fetch(`${API_BASE}/api/magazine?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('magazine list failed');
  const data = (await res.json()) as { articles: MagazineCard[]; total?: number };
  return {
    articles: data.articles || [],
    total: typeof data.total === 'number' ? data.total : (data.articles || []).length,
  };
}

export async function fetchMagazineFeatured(limit = 6): Promise<MagazineCard[]> {
  const res = await fetch(`${API_BASE}/api/magazine/featured?limit=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('magazine featured failed');
  const data = (await res.json()) as { articles: MagazineCard[] };
  return data.articles || [];
}
