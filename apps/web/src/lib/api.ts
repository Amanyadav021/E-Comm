/**
 * API client. In the browser everything goes through the same-origin `/api`
 * path (proxied to the backend by next.config rewrites) so auth cookies are
 * first-party. On the server we call the API directly.
 */

export class ApiError extends Error {
  status: number;
  issues?: Array<{ path: string; message: string }>;
  constructor(status: number, message: string, issues?: Array<{ path: string; message: string }>) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

const SERVER_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function baseUrl(): string {
  return typeof window === 'undefined' ? SERVER_BASE : '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}/api${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let issues;
    try {
      const data = await res.json();
      message = data.message ?? message;
      issues = data.issues;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, message, issues);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Server-component fetch for PUBLIC data (no cookies) with ISR-style caching. */
export async function publicFetch<T>(path: string, revalidateSeconds = 60): Promise<T | null> {
  try {
    const res = await fetch(`${SERVER_BASE}/api${path}`, { next: { revalidate: revalidateSeconds } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
