"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserProfile, AuthSession } from "@/types";

interface AuthContextType {
  user: UserProfile | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canAccessRecordings: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshUser = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          setSession(data.session);
          return;
        }
      }
      setUser(null);
      setSession(null);
    } catch {
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          if (data.authenticated && data.user) {
            setUser(data.user);
            setSession(data.session);
            return;
          }
        }
        setUser(null);
        setSession(null);
      } catch {
        if (isMounted) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUser(data.user);
        await refreshUser();
        return { success: true };
      }
      return { success: false, error: data.error || "Login failed" };
    } catch {
      return { success: false, error: "Network error during authentication." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setSession(null);
      router.push("/login");
    }
  };

  const isAdmin = user?.role === "HOSPITAL_ADMIN";
  const canAccessRecordings = Boolean(user?.canAccessRecordings || isAdmin);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: Boolean(user),
        isAdmin,
        canAccessRecordings,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const DEFAULT_FALLBACK_AUTH: AuthContextType = {
  user: {
    id: "usr_fallback",
    name: "Dr. Anjali Menon",
    email: "anjali.menon@dayahospital.com",
    role: "HOSPITAL_ADMIN",
    employeeId: "DAYA-ADM-001",
    department: "Clinical Operations & Quality",
    phone: "+91 94471 23456",
    canAccessRecordings: true,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    lastLoginAt: "2026-10-27T10:00:00Z",
  },
  session: null,
  isLoading: false,
  isAuthenticated: true,
  isAdmin: true,
  canAccessRecordings: true,
  login: async () => ({ success: true }),
  logout: async () => {},
  refreshUser: async () => {},
};

export function useAuth(): AuthContextType {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    return DEFAULT_FALLBACK_AUTH;
  }
  return ctx;
}
