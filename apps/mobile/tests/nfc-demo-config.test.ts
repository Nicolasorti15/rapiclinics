import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("APP_VARIANT", "device");
  vi.stubEnv("APP_IDENTIFIER", "app.nicolasorti.rapiclinics.nfctest");
  vi.stubEnv("EXPO_PUBLIC_API_URL", "https://example.com");
  vi.stubEnv("NFC_UID_DEMO", "1");
});
afterEach(() => vi.unstubAllEnvs());

it("enables the UID only in the explicitly selected test build", async () => {
  const { default: config } = await import("../app.config");
  expect(config.extra?.nfcUidDemo).toBe(true);
  expect(config.extra?.mode).toBe("demo");
  expect(config.name).toBe("RAPICLINICS NFC prueba");
});
it("leaves normal builds unchanged", async () => {
  vi.stubEnv("NFC_UID_DEMO", "");
  const { default: config } = await import("../app.config");
  expect(config.extra?.nfcUidDemo).toBe(false);
  expect(config.name).toBe("RAPICLINICS");
});
it("allows the explicitly enabled UID test in a production profile", async () => {
vi.stubEnv("APP_VARIANT", "production");
const { default: config } = await import("../app.config");
expect(config.extra?.nfcUidDemo).toBe(true);
expect(config.extra?.mode).toBe("clinical");
expect(config.name).toBe("RAPICLINICS NFC prueba");
});
