import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  api,
  currentSession,
  handleExpiry,
  saveSession,
} from "../src/api/client";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
}));

const user = {
  id: "user",
  name: "Demo",
  email: "demo@example.test",
  role: "PHYSICIAN",
};
const original = {
  access_token: "old-access",
  refresh_token: "old-refresh",
  user,
};
const renewed = {
  access_token: "new-access",
  refresh_token: "new-refresh",
  user,
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(async () => {
  vi.restoreAllMocks();
  await saveSession(null);
});

describe("authenticated API client", () => {
  it("does not send a stale credential when logged out", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await api("/health");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
  it("rotates expired credentials before retrying the original request", async () => {
    await saveSession(original);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json(renewed))
      .mockResolvedValueOnce(json([{ id: "patient" }]));
    vi.stubGlobal("fetch", fetchMock);
    expect(await api("/patients")).toEqual([{ id: "patient" }]);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(
      "Bearer new-access",
    );
    expect(currentSession()?.refresh_token).toBe("new-refresh");
  });
  it("clears invalid refresh tokens and returns to login", async () => {
    await saveSession(original);
    const expired = vi.fn();
    handleExpiry(expired);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ detail: "Sesión caducada." }, 401)),
    );
    await expect(api("/patients")).rejects.toThrow("Sesión caducada.");
    expect(expired).toHaveBeenCalledOnce();
    expect(currentSession()).toBeNull();
  });
  it("preserves the session on temporary network failure", async () => {
    await saveSession(original);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(api("/patients")).rejects.toThrow("No se pudo conectar");
    expect(currentSession()).toEqual(original);
  });
  it("preserves actionable backend validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(json({ detail: "Identidad discrepante." }, 409)),
    );
    await expect(api("/documents/x/validate", "POST", {})).rejects.toThrow(
      "Identidad discrepante.",
    );
  });
  it("lets the platform set multipart boundaries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("scan_id", "scan");
    await api("/documents", "POST", form);
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  });
});
