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

export interface AuthUser {
  id: number;
  uuid: string;
  email: string;
  name: string | null;
  role: string;
}

export const authApi = {
  me: () => apiGet<{ user: AuthUser | null }>('/auth/me'),
  login: (data: { email: string; password: string }) =>
    apiPost<{ user: AuthUser }>('/auth/login', data),
  register: (data: { email: string; password: string; name?: string }) =>
    apiPost<{ user: AuthUser }>('/auth/register', data),
  logout: () => apiPost<{ ok: boolean }>('/auth/logout'),
};

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
  fundingFeeUsd?: number;
  fundingFees?: FundingFeeRecord[];
  result?: 'win' | 'loss' | 'breakeven';
  strategy?: string | null;
  notes?: string | null;
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
  asynSyncCount?: number;
  lastAsynSyncAt?: string;
  asynSyncTasks?: {
    downloadId: string;
    status: string;
    downloadUrl: string | null;
    createdAt: string;
  }[];
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

  update: (id: number, data: { strategy?: string; notes?: string }) => apiPut(`/legs/${id}`, data),
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
  syncByCsv: (apiKeyId: number, file: File, headerMapping?: Record<string, string>) => {
    const formData = new FormData();
    formData.append('apiKeyId', apiKeyId.toString());
    formData.append('file', file);
    if (headerMapping) {
      formData.append('headerMapping', JSON.stringify(headerMapping));
    }
    return fetch('/api/sync/csv', {
      method: 'POST',
      body: formData,
    }).then(handleResponse);
  },
  detectCsvHeaders: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/api/sync/csv/headers', {
      method: 'POST',
      body: formData,
    }).then(handleResponse) as Promise<{ headers: string[] }>;
  },
  requestAsynSync: (apiKeyId: number) => apiPost('/sync/asyn-request', { apiKeyId }),
  checkAsynSyncStatus: (apiKeyId: number, downloadId: string) => 
    apiGet<{ status: string; url?: string }>('/sync/asyn-status', { apiKeyId, downloadId }),
  getBalance: (apiKeyId?: number) => apiGet<{ balance: number }>('/accounts/balance', { apiKeyId }),
  calculateMaeMfe: (apiKeyId: number) => apiPost('/sync/mae-mfe', { apiKeyId }),
};

// Funding Fee API
export interface FundingFeeRecord {
  id: number;
  apiKeyId: number;
  legId: number | null;
  tranId: string | null;
  incomeType: string;
  asset: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  info: string | null;
  timestamp: string;
  apiKey?: { name: string; exchange: string };
  leg?: { id: number; symbol: string; side: string; status: string } | null;
}

export const fundingApi = {
  getList: (params?: {
    apiKeyId?: number;
    symbol?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) => apiGet<{ data: FundingFeeRecord[]; pagination: any }>('/funding', params),
  syncByCsv: (apiKeyId: number, file: File, headerMapping?: Record<string, string>) => {
    const formData = new FormData();
    formData.append('apiKeyId', apiKeyId.toString());
    formData.append('file', file);
    if (headerMapping) {
      formData.append('headerMapping', JSON.stringify(headerMapping));
    }
    return fetch('/api/funding', {
      method: 'POST',
      body: formData,
    }).then(handleResponse);
  },
  detectCsvHeaders: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/api/funding/headers', {
      method: 'POST',
      body: formData,
    }).then(handleResponse) as Promise<{ headers: string[] }>;
  },
  syncByApi: (apiKeyId: number) => apiPost('/funding/sync', { apiKeyId }),
  associate: (apiKeyId: number) => apiPost('/funding/associate', { apiKeyId }) as Promise<{ message: string; associated: number; legsUpdated: number }>,
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

export interface GlobalFilter {
  startDate?: string;
  endDate?: string;
  symbol?: string;
  apiKeyId?: number;
}

// Analytics API
export const analyticsApi = {
  getSummary: (filters?: GlobalFilter) => apiGet<SummaryStats>('/analytics/summary', filters),
  getPnLCurve: (filters?: GlobalFilter & { days?: number }) => apiGet<PnLPoint[]>('/analytics/pnl-curve', filters),
  getBySymbol: (filters?: GlobalFilter) => apiGet<SymbolStats[]>('/analytics/by-symbol', filters),
  getWeekday: (filters?: GlobalFilter) => apiGet<WeekdayStats[]>('/analytics/weekday', filters),
  getHourly: (filters?: GlobalFilter) => apiGet<HourlyStats[]>('/analytics/hourly', filters),
  getDuration: (filters?: GlobalFilter) => apiGet<DurationStats[]>('/analytics/duration', filters),
  getSize: (filters?: GlobalFilter) => apiGet<SizeStats[]>('/analytics/size', filters),
  getDaily: (year?: number, month?: number, filters?: GlobalFilter) => 
    apiGet<DailyPnL[]>('/analytics/daily', { year, month, ...filters }),
};
