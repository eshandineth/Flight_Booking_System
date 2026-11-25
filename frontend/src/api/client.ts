import { Booking, Flight, FlightFormInput, SeatInfo, User } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_STORAGE_KEY = 'skybooker_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data as T;
}

export const api = {
  register(payload: { name: string; email: string; password: string }) {
    return request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMe() {
    return request<{ user: User }>('/api/auth/me');
  },

  searchFlights(filters: { from?: string; to?: string; date?: string }) {
    const params = new URLSearchParams();
    if (filters.from?.trim()) params.set('from', filters.from.trim());
    if (filters.to?.trim()) params.set('to', filters.to.trim());
    if (filters.date?.trim()) params.set('date', filters.date.trim());
    const qs = params.toString();
    return request<{ flights: Flight[] }>(`/api/flights${qs ? `?${qs}` : ''}`);
  },

  getFlightDetails(flightId: number) {
    return request<{ flight: Flight; seats: SeatInfo[] }>(
      `/api/flights/${flightId}`
    );
  },

  createFlight(payload: FlightFormInput) {
    return request<{ flight: Flight }>('/api/flights', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateFlight(flightId: number, payload: FlightFormInput) {
    return request<{ flight: Flight }>(`/api/flights/${flightId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteFlight(flightId: number) {
    return request<{ deleted: boolean; id: number }>(
      `/api/flights/${flightId}`,
      {
        method: 'DELETE',
      }
    );
  },

  createBooking(payload: { flightId: number; seatNumber: string }) {
    return request<{ booking: Booking }>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyBookings() {
    return request<{ bookings: Booking[] }>('/api/bookings/my');
  },

  cancelBooking(bookingId: number) {
    return request<{ booking: Booking }>(`/api/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
    });
  },
};

