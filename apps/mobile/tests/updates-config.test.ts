import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../app.config";

describe("EAS Update configuration", () => {
  it("pins OTA updates to the native app version and owned Expo project", () => {
    expect(config.version).toBe("1.4.0");
    expect(config.runtimeVersion).toEqual({ policy: "appVersion" });
    expect(config.updates).toMatchObject({
      enabled: true,
      checkAutomatically: "ON_ERROR_RECOVERY",
      url: "https://u.expo.dev/0b4566df-74e0-49e0-8d7b-cc927a30fc6f",
    });
  });

  it("uses the production channel without the hard-coded NFC test card", () => {
    const eas = JSON.parse(
      readFileSync(new URL("../eas.json", import.meta.url), "utf8"),
    );
    expect(eas.build["clinical-apk"].channel).toBe("production");
    expect(eas.build["clinical-apk"].env.NFC_UID_DEMO).toBeUndefined();
    expect(eas.build.preview.channel).toBe("preview");
  });
});
