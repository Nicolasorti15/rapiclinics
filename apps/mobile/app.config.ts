import type { ExpoConfig } from "expo/config";

const production = process.env.APP_VARIANT === "production";
const nfcUidDemo = process.env.NFC_UID_DEMO === "1";
const physicalDevice = process.env.APP_VARIANT === "device";
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const projectId =
  process.env.EAS_PROJECT_ID || "0b4566df-74e0-49e0-8d7b-cc927a30fc6f";
if (physicalDevice) {
  let target: URL;
  try {
    target = new URL(apiUrl || "");
  } catch {
    throw new Error(
      "Device builds require EXPO_PUBLIC_API_URL pointing to your reachable API.",
    );
  }
  if (
    !["http:", "https:"].includes(target.protocol) ||
    ["localhost", "127.0.0.1", "[::1]", "10.0.2.2"].includes(target.hostname)
  ) {
    throw new Error(
      "A physical phone cannot use a localhost or emulator API address. Set EXPO_PUBLIC_API_URL to your server.",
    );
  }
  if (!projectId || !process.env.APP_IDENTIFIER) {
    throw new Error(
      "Device builds require EAS_PROJECT_ID and an owned APP_IDENTIFIER.",
    );
  }
}
if (
  production &&
  (!apiUrl?.startsWith("https://") || !projectId || !process.env.APP_IDENTIFIER)
) {
  throw new Error(
    "Production builds require HTTPS EXPO_PUBLIC_API_URL, EAS_PROJECT_ID and an owned APP_IDENTIFIER.",
  );
}
const identifier = process.env.APP_IDENTIFIER || "app.rapiclinics.demo";
const liveAds = process.env.ADMOB_MODE === "live";
const adsAppId = process.env.ADMOB_ANDROID_APP_ID;
const adsBannerId = process.env.ADMOB_ANDROID_BANNER_ID;
if (
  liveAds &&
  (!/^ca-app-pub-\d{16}~\d{10}$/.test(adsAppId || "") ||
    !/^ca-app-pub-\d{16}\/\d{10}$/.test(adsBannerId || "") ||
    adsAppId?.includes("3940256099942544") ||
    adsBannerId?.includes("3940256099942544"))
) {
  throw new Error(
    "Live AdMob requires your Android app ID and banner unit ID.",
  );
}
const config: ExpoConfig = {
  name: nfcUidDemo ? "RAPICLINICS NFC prueba" : "RAPICLINICS",
  slug: "rapiclinics",
  owner: "nicolasorti-team",
  version: "1.3.0",
  orientation: "portrait",
  scheme: "rapiclinics",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: identifier,
    buildNumber: "5",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSMicrophoneUsageDescription:
        "Graba una visita cuando pulses el botón de grabación.",
      NSAppTransportSecurity: { NSAllowsLocalNetworking: !production },
    },
  },
  android: {
    allowBackup: false,
    package: identifier,
    versionCode: 5,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#176B70",
    },
    permissions: ["android.permission.NFC", "android.permission.RECORD_AUDIO"],
    blockedPermissions: [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
    name: "RAPICLINICS",
    shortName: "RAPICLINICS",
  },
  plugins: [
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: liveAds
          ? adsAppId
          : "ca-app-pub-3940256099942544~3347511713",
        iosAppId: "ca-app-pub-3940256099942544~1458002511",
        delayAppMeasurementInit: true,
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission:
          "Graba una visita cuando pulses el botón de grabación.",
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    "expo-secure-store",
    "expo-font",
    "expo-asset",
    "expo-document-picker",
    "expo-sharing",
    [
      "react-native-nfc-manager",
      {
        nfcPermission:
          "Lee el identificador de la cama para confirmar al paciente.",
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          usesCleartextTraffic: !production,
        },
        ios: { deploymentTarget: "16.4" },
      },
    ],
  ],
  extra: {
    nfcUidDemo,
    ads: {
      mode: liveAds ? "live" : "test",
      androidBannerId: liveAds ? adsBannerId : null,
    },
    mode: production ? "clinical" : "demo",
    eas: { projectId },
  },
};
export default config;
