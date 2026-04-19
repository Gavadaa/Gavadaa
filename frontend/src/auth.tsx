import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, saveToken, clearToken, getToken, errMsg } from "./api";
import { DEFAULT_RANK, RankInfo } from "./ranks";

export type User = {
  id: string;
  email: string;
  dj_name: string;
  total_xp: number;
  total_minutes: number;
  sessions_count: number;
  streak_days: number;
  last_session_date: string | null;
  completed_challenges: string[];
  is_premium: boolean;
  role: string;
  friend_code?: string;
  friends?: string[];
  rank_info: RankInfo;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, djName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (!t) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get<User>("/auth/me");
        setUser({ ...data, rank_info: data.rank_info || DEFAULT_RANK });
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      await saveToken(data.token);
      setUser(data.user);
    } catch (e) {
      throw new Error(errMsg(e));
    }
  };

  const register = async (email: string, password: string, djName: string) => {
    try {
      const { data } = await api.post("/auth/register", { email, password, dj_name: djName });
      await saveToken(data.token);
      setUser(data.user);
    } catch (e) {
      throw new Error(errMsg(e));
    }
  };

  const logout = async () => {
    await clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get<User>("/auth/me");
      setUser({ ...data, rank_info: data.rank_info || DEFAULT_RANK });
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
