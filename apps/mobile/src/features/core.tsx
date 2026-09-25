import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useNetworkState } from "expo-network";
import { api, handleExpiry, restoreSession, saveSession } from "../api/client";
import type { Session } from "../types";
import { Notice } from "../components/ui";
import {
  syncUrgentNotifications,
  unregisterUrgentNotifications,
} from "./notifications";

const Auth = createContext<{
  session: Session | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: {
    token: string;
    email: string;
    name: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}>({
  session: null,
  ready: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    handleExpiry(() => setSession(null));
    restoreSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (session) void syncUrgentNotifications(false).catch(() => {});
  }, [session]);
  const login = async (email: string, password: string) => {
    const result = await api<Session>("/auth/login", "POST", {
      email,
      password,
    });
    await saveSession(result);
    setSession(result);
  };
  const logout = async () => {
    try {
      await unregisterUrgentNotifications().catch(() => {});
      await api("/auth/logout", "POST");
    } finally {
      await saveSession(null);
      setSession(null);
    }
  };
  const register = async (body: {
    token: string;
    email: string;
    name: string;
    password: string;
  }) => {
    const result = await api<Session>("/auth/register", "POST", body);
    await saveSession(result);
    setSession(result);
  };
  return (
    <Auth.Provider value={{ session, ready, login, register, logout }}>
      {children}
    </Auth.Provider>
  );
}
export const useAuth = () => useContext(Auth);
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return { data, loading, error, reload };
}
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la acción.";
export function useAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (work: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}
export function OfflineBanner() {
  const network = useNetworkState();
  return network.isConnected === false ||
    network.isInternetReachable === false ? (
    <Notice
      error
      text="Sin conexión. Mantén esta pantalla abierta para conservar lo que estás editando; confirma y sincroniza cuando vuelva la conexión."
    />
  ) : null;
}
