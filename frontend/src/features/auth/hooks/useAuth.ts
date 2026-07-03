import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  loginUser,
  logoutUser,
  signupUser,
} from '@/features/auth/services/authApi';
import { postAuthDestination } from '@/features/auth/utils/authDecisions';
import { useAuthStore } from '@/features/auth/store/authStore';
import { notify } from '@/shared/utils/notify';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { access_token, user } = await loginUser(email, password);
      setAuth(user, access_token);
      notify.success('Welcome back!', `Signed in as ${user.email}`);
      navigate(postAuthDestination(user.setupComplete), { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      const message = e.response?.data?.detail || e.response?.data?.message || 'Invalid email or password.';
      notify.error('Login Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading };
}

export function useSignup() {
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const signup = async (formData: { fullName: string; email: string; password: string }) => {
    setIsLoading(true);
    try {
      const { access_token, user } = await signupUser(formData);
      setAuth(user, access_token);
      notify.success('Account Created', 'Welcome to VirtAI!');
      navigate(postAuthDestination(user.setupComplete), { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      const message = e.response?.data?.detail || e.response?.data?.message || 'Could not create account.';
      notify.error('Signup Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return { signup, isLoading };
}

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);

  const startGoogleAuth = async () => {
    setIsLoading(true);
    try {
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch {
      notify.error('Google Auth', 'Could not connect to Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return { startGoogleAuth, isLoading };
}

export function useGoogleCallback() {
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleCallback = async (code: string, state: string) => {
    setIsLoading(true);
    try {
      const { access_token, user } = await exchangeGoogleCode(code, state);
      setAuth(user, access_token);
      notify.success('Welcome!', `Signed in as ${user.email}`);
      navigate(postAuthDestination(user.setupComplete), { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } } };
      const message = e.response?.data?.detail || e.response?.data?.message || 'Google sign-in failed.';
      notify.error('Auth Failed', message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { handleCallback, isLoading };
}

export function useRestoreSession() {
  const initAuth = useAuthStore((s) => s.initAuth);

  const restore = useCallback(async () => {
    await initAuth();
  }, [initAuth]);

  return { restore };
}

export function useLogout() {
  const storeLogout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // ignore — logout API failure should not prevent local session clear
    }
    storeLogout();
    navigate('/');
  };

  return { logout };
}
