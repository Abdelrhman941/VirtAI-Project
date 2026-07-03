import apiClient from '@/core/api/apiClient';
import type { User } from '../store/authStore';

// ─── Response / Param shapes ──────────────────────────────────────────────────

export interface AuthResponse {
  access_token: string;
  user: User;
}

interface SignupParams {
  fullName: string;
  email: string;
  password: string;
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function signupUser({ fullName, email, password }: SignupParams): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/signup', {
    full_name: fullName,
    email,
    password,
  });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export async function updateSetupStatus(setupComplete = true): Promise<User> {
  const { data } = await apiClient.patch<User>('/auth/me/setup', {
    setup_complete: setupComplete,
  });
  return data;
}

export async function getGoogleAuthUrl(): Promise<string> {
  const { data } = await apiClient.get<{ url: string }>('/auth/google/url');
  return data.url;
}

export async function exchangeGoogleCode(code: string, state: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/google/callback', { code, state });
  return data;
}

export async function logoutUser(): Promise<void> {
  await apiClient.post('/auth/logout');
}
