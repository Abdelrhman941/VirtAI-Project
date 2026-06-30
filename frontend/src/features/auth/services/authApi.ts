import apiClient from '@/core/api/apiClient';

export async function loginUser(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data;
}

export async function signupUser({ fullName, email, password }) {
  const { data } = await apiClient.post('/auth/signup', {
    full_name: fullName,
    email,
    password,
  });
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get('/auth/me');
  return data;
}

export async function updateSetupStatus(setupComplete = true) {
  const { data } = await apiClient.patch('/auth/me/setup', {
    setup_complete: setupComplete,
  });
  return data;
}

export async function getGoogleAuthUrl() {
  const { data } = await apiClient.get('/auth/google/url');
  return data.url;
}

export async function exchangeGoogleCode(code, state) {
  const { data } = await apiClient.post('/auth/google/callback', { code, state });
  return data;
}

export async function logoutUser() {
  await apiClient.post('/auth/logout');
}
