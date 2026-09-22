export interface GlobalSearchResult {
  users: Array<{
    id: number;
    fullName: string;
    email: string;
    phone: string | null;
    role: string;
    status: string;
    avatarUrl: string | null;
  }>;
  facilities: Array<{
    id: number;
    name: string;
    address: string;
    city: string;
    phone: string;
    status: string;
  }>;
  tournaments: Array<{
    id: number;
    name: string;
    format: string;
    status: string;
  }>;
  reports: Array<{
    id: number;
    reasonCode: string;
    description: string | null;
    status: string;
  }>;
}

export const adminGlobalSearchService = {
  async search(query: string): Promise<GlobalSearchResult> {
    if (!query.trim()) {
      return {
        users: [],
        facilities: [],
        tournaments: [],
        reports: [],
      };
    }

    const res = await fetch(`/api/v1/admin/global-search?q=${encodeURIComponent(query.trim())}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'admin@smashpro.vn',
      },
    });
    if (!res.ok) {
      throw new Error(`Global search failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.data;
  },
};
