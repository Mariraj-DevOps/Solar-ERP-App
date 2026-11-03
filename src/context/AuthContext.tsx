import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from '../lib/api';

export type UserRole = 'master_admin' | 'secondary_admin' | 'staff' | 'admin' | 'labourer';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  designation?: string;
  assignedLocation?: string;
  mobileNumber?: string;
  maskedAadhaar?: string;
  assignedTeamId?: string;
  assignedWorksiteId?: string;
  assignedSupervisorId?: string;
  isAttendanceParticipant?: boolean;
  assignedAdmin?: { id: string; fullName: string; role: string; email: string } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isMasterAdmin: boolean;
  isSecondaryAdmin: boolean;
  isAdminAny: boolean;
  isStaff: boolean;
  isLabourer: boolean;
  isAttendanceParticipant: boolean;
  login: (emailOrMobile: string, pass: string) => Promise<void>;
  requestOtp: (mobileNumber: string) => Promise<{ success: boolean; message: string; otpCode?: string }>;
  loginWithOtp: (mobileNumber: string, otpCode: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.auth.me();
      setUser(res.user);
    } catch {
      setUser(null);
      setStoredToken(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('erp:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('erp:auth-expired', handleAuthExpired);
  }, []);

  const login = async (emailOrMobile: string, pass: string) => {
    const res = await api.auth.login({ email: emailOrMobile, password: pass });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const requestOtp = async (mobileNumber: string) => {
    return api.auth.requestOtp({ mobileNumber });
  };

  const loginWithOtp = async (mobileNumber: string, otpCode: string) => {
    const res = await api.auth.verifyOtp({ mobileNumber, otpCode });
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  };

  const isMasterAdmin = Boolean(user && (user.role === 'master_admin' || user.role === 'admin'));
  const isSecondaryAdmin = Boolean(user && user.role === 'secondary_admin');
  const isAdminAny = isMasterAdmin || isSecondaryAdmin;
  const isStaff = Boolean(user && user.role === 'staff');
  const isLabourer = Boolean(user && user.role === 'labourer');
  const isAttendanceParticipant = Boolean(user && (user.isAttendanceParticipant || user.role === 'labourer'));

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isMasterAdmin,
        isSecondaryAdmin,
        isAdminAny,
        isStaff,
        isLabourer,
        isAttendanceParticipant,
        login,
        requestOtp,
        loginWithOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

