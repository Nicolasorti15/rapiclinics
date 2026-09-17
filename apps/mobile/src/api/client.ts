import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { Session } from "../types";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://localhost:8000");
let session: Session | null = null;
let onExpired: (() => void) | undefined;
let refreshPromise: Promise<void> | null = null;
const key = "rapiclinics.session";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function handleExpiry(callback: () => void) {
  onExpired = callback;
}
export function currentSession() {
  return session;
}
export async function saveSession(value: Session | null) {
  session = value;
  // Browser preview sessions deliberately stay in memory; native sessions use Keychain/Keystore.
  if (Platform.OS !== "web") {
    if (value)
      await SecureStore.setItemAsync(key, JSON.stringify(value), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    else await SecureStore.deleteItemAsync(key);
  }
}
export async function restoreSession() {
  if (Platform.OS === "web") return null;
  const saved = await SecureStore.getItemAsync(key);
  try {
    session = saved ? JSON.parse(saved) : null;
  } catch {
    await saveSession(null);
  }
  return session;
}

async function responseError(response: Response): Promise<never> {
  const data = await response.json().catch(() => ({}));
  throw new ApiError(
    typeof data.detail === "string"
      ? data.detail
      : "Revisa los datos e inténtalo de nuevo.",
    response.status,
  );
}
async function send(path: string, options: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    path.endsWith("/transcribe") ? 240000 : 30000,
  );
  try {
    return await fetch(API_URL + path, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}
async function refresh() {
  const existing = session;
  if (!existing) throw new ApiError("Inicia sesión para continuar.", 401);
  const response = await send("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: existing.refresh_token }),
  });
  if (!response.ok) {
    if (response.status === 401) {
      await saveSession(null);
      onExpired?.();
    }
    await responseError(response);
  }
  await saveSession(await response.json());
}
export async function apiResponse(path: string, options: RequestInit = {}) {
  let response = await send(path, options);
  if (
    response.status === 401 &&
    session &&
    path !== "/auth/login" &&
    path !== "/auth/refresh"
  ) {
    if (!refreshPromise)
      refreshPromise = refresh().finally(() => {
        refreshPromise = null;
      });
    await refreshPromise;
    response = await send(path, options);
  }
  if (!response.ok) await responseError(response);
  return response;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await apiResponse(path, {
    method,
    ...(body === undefined
      ? {}
      : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
  return response.json();
}
export async function appendFile(
  form: FormData,
  uri: string,
  name: string,
  mime: string,
) {
  if (Platform.OS === "web")
    form.append("file", await (await fetch(uri)).blob(), name);
  else form.append("file", { uri, name, type: mime } as unknown as Blob);
}
