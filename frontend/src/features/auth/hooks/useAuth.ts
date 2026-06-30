import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  loginUser,
  logoutUser,
  signupUser,
} from '@/features/auth/services/authApi';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const { access_token, user } = await loginUser(email, password);
      setAuth(user, access_token);
      toast.success('Welcome back!', { description: `Signed in as ${user.email}` });
      navigate(user.setupComplete ? '/classroom' : '/setup', { replace: true });
    } catch (err) {
      const message = err.response?.data?.detail || err.response?.data?.message || 'Invalid email or password.';
      toast.error('Login Failed', { description: message });
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

  const signup = async (formData) => {
    setIsLoading(true);
    try {
      const { access_token, user } = await signupUser(formData);
      setAuth(user, access_token);
      toast.success('Account Created', { description: 'Welcome to VirtAI!' });
      navigate(user.setupComplete ? '/classroom' : '/setup', { replace: true });
    } catch (err) {
      const message = err.response?.data?.detail || err.response?.data?.message || 'Could not create account.';
      toast.error('Signup Failed', { description: message });
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
      toast.error('Google Auth', { description: 'Could not connect to Google.' });
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

  const handleCallback = async (code, state) => {
    setIsLoading(true);
    try {
      const { access_token, user } = await exchangeGoogleCode(code, state);
      setAuth(user, access_token);
      toast.success('Welcome!', { description: `Signed in as ${user.email}` });
      navigate(user.setupComplete ? '/classroom' : '/setup', { replace: true });
    } catch (err) {
      const message = err.response?.data?.detail || err.response?.data?.message || 'Google sign-in failed.';
      toast.error('Auth Failed', { description: message });
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
      // ignore
    }
    storeLogout();
    navigate('/');
  };

  return { logout };
}
