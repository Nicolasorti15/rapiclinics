import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  AppState,
  Platform,
  TurboModuleRegistry,
  useWindowDimensions,
} from "react-native";
import Constants from "expo-constants";
import { useIsFocused } from "@react-navigation/native";

const Banner = lazy(() =>
  import("./NativeBanner").catch(() => ({ default: () => null })),
);

export function HomeBanner() {
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => listener.remove();
  }, []);
  if (
    width < 360 ||
    !focused ||
    !active ||
    Platform.OS !== "android" ||
    Constants.executionEnvironment === "storeClient" ||
    !TurboModuleRegistry.get("RNGoogleMobileAdsModule")
  )
    return null;
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}
