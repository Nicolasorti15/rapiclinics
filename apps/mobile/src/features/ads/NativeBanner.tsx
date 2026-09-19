import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Constants from "expo-constants";
import mobileAds, {
  AdsConsent,
  BannerAd,
  BannerAdSize,
  MaxAdContentRating,
  TestIds,
} from "react-native-google-mobile-ads";
import { s } from "../../components/ui";

const config = Constants.expoConfig?.extra?.ads;
const live = config?.mode === "live";
const unitId = live ? config.androidBannerId : TestIds.BANNER;
const requestOptions = { requestNonPersonalizedAdsOnly: true };
let initialized: Promise<unknown> | undefined;
function initialize() {
  initialized ??= mobileAds()
    .setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.G,
      publisherPrivacyPersonalizationState: "disabled",
    })
    .then(() => mobileAds().initialize())
    .catch((error) => {
      initialized = undefined;
      throw error;
    });
  return initialized;
}

export default function NativeBanner() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [privacyRequired, setPrivacyRequired] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function start() {
      if (!unitId) return;
      if (live) {
        const info = await AdsConsent.gatherConsent();
        if (!mounted) return;
        setPrivacyRequired(info.privacyOptionsRequirementStatus === "REQUIRED");
        if (!info.canRequestAds) return;
      }
      if (!mounted) return;
      await initialize();
      if (mounted) setReady(true);
    }
    void start().catch(() => {
      if (mounted) setFailed(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  async function privacy() {
    setReady(false);
    setPrivacyError(false);
    try {
      await AdsConsent.showPrivacyOptionsForm();
      const info = await AdsConsent.getConsentInfo();
      setReady(info.canRequestAds);
      setFailed(false);
    } catch {
      setPrivacyError(true);
    }
  }
  if ((!ready || failed) && !privacyRequired) return null;
  return (
    <View style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
      {ready && !failed && (
        <>
          <Text style={s.small}>
            {live ? "Publicidad" : "Publicidad · anuncio de prueba"}
          </Text>
          <BannerAd
            unitId={unitId}
            size={BannerAdSize.BANNER}
            requestOptions={requestOptions}
            onAdFailedToLoad={() => setFailed(true)}
          />
        </>
      )}
      {privacyRequired && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void privacy()}
          style={{ padding: 12 }}
        >
          <Text style={s.small}>Opciones de privacidad publicitaria</Text>
        </Pressable>
      )}
      {privacyError && (
        <Text style={s.small}>
          No se pudo abrir. Puedes volver a intentarlo.
        </Text>
      )}
    </View>
  );
}
