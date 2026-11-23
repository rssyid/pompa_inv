"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ClientSessionUser } from "./AppShell";
import { MasterTreeData } from "./HierarchyFilterBar";
import { fetchJson } from "@/lib/client-fetch";

interface AppDataContextValue {
  user: ClientSessionUser | null;
  master: MasterTreeData | null;
  loading: boolean;
  error: string | null;
  ensureLoaded: () => Promise<{ user: ClientSessionUser; master: MasterTreeData } | null>;
  refreshSession: () => Promise<void>;
  refreshMaster: () => Promise<void>;
  clearSession: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<ClientSessionUser | null>(null);
  const [master, setMaster] = useState<MasterTreeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRef = useRef<ClientSessionUser | null>(null);
  const masterRef = useRef<MasterTreeData | null>(null);
  const inFlightRef = useRef<Promise<{ user: ClientSessionUser; master: MasterTreeData } | null> | null>(
    null
  );

  const ensureLoaded = useCallback(async () => {
    if (userRef.current && masterRef.current) {
      return { user: userRef.current, master: masterRef.current };
    }
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    setLoading(true);
    setError(null);

    const promise = (async () => {
      try {
        const [meRes, treeRes] = await Promise.all([
          fetchJson<{ user: ClientSessionUser }>("/api/auth/me"),
          fetchJson<MasterTreeData>("/api/master/tree?includeParts=false"),
        ]);
        userRef.current = meRes.user;
        masterRef.current = treeRes;
        setUser(meRes.user);
        setMaster(treeRes);
        return { user: meRes.user, master: treeRes };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data sesi.");
        return null;
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = promise;
    return promise;
  }, []);

  const refreshSession = useCallback(async () => {
    userRef.current = null;
    masterRef.current = null;
    setUser(null);
    setMaster(null);
    await ensureLoaded();
  }, [ensureLoaded]);

  const refreshMaster = useCallback(async () => {
    try {
      const treeRes = await fetchJson<MasterTreeData>("/api/master/tree?includeParts=false");
      masterRef.current = treeRes;
      setMaster(treeRes);
    } catch {
      // Keep previous cached master if background refresh fails.
    }
  }, []);

  const clearSession = useCallback(() => {
    userRef.current = null;
    masterRef.current = null;
    setUser(null);
    setMaster(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (pathname !== "/login") {
      void ensureLoaded();
    }
  }, [pathname, ensureLoaded]);

  return (
    <AppDataContext.Provider
      value={{
        user,
        master,
        loading,
        error,
        ensureLoaded,
        refreshSession,
        refreshMaster,
        clearSession,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData harus digunakan di dalam AppDataProvider.");
  }
  return ctx;
}
