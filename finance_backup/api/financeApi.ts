/**
 * Archived Finance API Client Definitions
 * Originally part of src/lib/api.ts
 */

export const financeApi = {
  officeLedger: {
    list: (params: { startDate?: string; endDate?: string; category?: string; secondaryAdminId?: string } = {}) => {
      const q = new URLSearchParams();
      if (params.startDate) q.set('startDate', params.startDate);
      if (params.endDate) q.set('endDate', params.endDate);
      if (params.category) q.set('category', params.category);
      if (params.secondaryAdminId) q.set('secondaryAdminId', params.secondaryAdminId);
      return `/office-ledger?${q.toString()}`;
    },
    create: (data: any) => ({ url: '/office-ledger', method: 'POST', body: JSON.stringify(data) }),
  },

  pettyCash: {
    get: (params: { startDate?: string; endDate?: string; month?: number | string; year?: number | string; secondaryAdminId?: string } = {}) => {
      const q = new URLSearchParams();
      if (params.startDate) q.set('startDate', params.startDate);
      if (params.endDate) q.set('endDate', params.endDate);
      if (params.month !== undefined) q.set('month', String(params.month));
      if (params.year !== undefined) q.set('year', String(params.year));
      if (params.secondaryAdminId) q.set('secondaryAdminId', params.secondaryAdminId);
      return `/petty-cash?${q.toString()}`;
    },
    create: (data: any) => ({ url: '/petty-cash', method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => ({ url: `/petty-cash/${id}`, method: 'DELETE' }),
  },
};
