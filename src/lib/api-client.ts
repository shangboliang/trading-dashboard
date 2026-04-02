/**
 * API 客户端工具
 * 封装 fetch 请求，统一处理错误和响应
 */

const API_BASE = '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '网络请求失败');
  }
  return response.json();
}

export async function apiGet<T>(path: string, params?: Record<string, any>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  
  const response = await fetch(url.toString());
  return handleResponse<T>(response);
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function apiPut<T>(path: string, body?: any): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
  });
  return handleResponse<T>(response);
}

// ==================== API 方法封装 ====================

export interface Leg {
  id: number;
  uuid: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  openDate: string;
  closeDate?: string;
  averageEntry: number;
  averageExit?: number;
  realisedPnLusd: number;
  netPnL: number;
  duration: number;
  sizeUsd: number;
  commission: number;
  result?: 'win' | 'loss' | 'breakeven';
  tags?: any[];
}

export interface ApiAccount {
  id: number;
  uuid: string;
  name: string;
  exchange: string;
  apiKey: string;
  isVerified: boolean;
  lastSyncAt?: string;
  syncStatus: string;
  errorMessage?: string;
  createdAt: string;
}

export interface SummaryStats {
  countPositions: number;
  totalRealisedPnL: number;
  avgRealisedPnL: number;
  winRate: number;
  profitFactor: number;
  totalCommission: number;
  avgDuration: number;
  wins: {
    countLegs: number;
    totalRealisedPnL: number;
    avgRealisedPnL: number;
  };
  loss: {
    countLegs: number;
    totalRealisedPnL: number;
    avgRealisedPnL: number;
  };
}

export interface PnLPoint {
  date: string;
  cumulativePnL: number;
  closedLegs: number;
}

export interface SymbolStats {
  symbol: string;
  countLegs: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  profitFactor: number | null;
  avgDuration: number;
}

// Legs API
export const legsApi = {
  getList: (params?: {
    status?: string;
    symbol?: string;
    side?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => apiGet<{ data: Leg[]; pagination: any }>('/legs', params),
  
  getById: (id: number) => apiGet<Leg>(`/legs/${id}`),
};

// Accounts API
export const accountsApi = {
  getList: () => apiGet<ApiAccount[]>('/accounts'),
  getById: (id: number) => apiGet<ApiAccount>(`/accounts/${id}`),
  create: (data: { name: string; exchange: string; apiKey: string; apiSecret: string; passphrase?: string }) => 
    apiPost<ApiAccount>('/accounts', data),
  update: (id: number, data: any) => apiPut(`/accounts/${id}`, data),
  delete: (id: number) => apiDelete(`/accounts/${id}`),
  sync: (apiKeyId: number) => apiPost('/sync', { apiKeyId }),
};

export interface WeekdayStats {
  rangeStart: number;
  countLegs: number;
  totalRealisedPnL: number;
}

export interface HourlyStats {
  rangeStart: number;
  countLegs: number;
  totalRealisedPnL: number;
}

export interface DurationStats {
  range: string;
  count: number;
  pnl: number;
}

export interface SizeStats {
  rangeStart: number;
  wins: { countLegs: number };
  loss: { countLegs: number };
}

export interface DailyPnL {
  date: string;
  pnl: number;
  count: number;
}

// Analytics API
export const analyticsApi = {
  getSummary: () => apiGet<SummaryStats>('/analytics/summary'),
  getPnLCurve: (days?: number) => apiGet<PnLPoint[]>('/analytics/pnl-curve', { days }),
  getBySymbol: () => apiGet<SymbolStats[]>('/analytics/by-symbol'),
  getWeekday: () => apiGet<WeekdayStats[]>('/analytics/weekday'),
  getHourly: () => apiGet<HourlyStats[]>('/analytics/hourly'),
  getDuration: () => apiGet<DurationStats[]>('/analytics/duration'),
  getSize: () => apiGet<SizeStats[]>('/analytics/size'),
  getDaily: (year?: number, month?: number) => apiGet<DailyPnL[]>('/analytics/daily', { year, month }),
};
