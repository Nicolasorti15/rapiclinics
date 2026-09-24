import React, { PropsWithChildren, useEffect, useState } from "react";
import { View } from "react-native";
import * as Updates from "expo-updates";
import { Body, c, Icon, Loading, Title } from "../components/ui";

export function AppUpdateGate({ children }: PropsWithChildren) {
  const [checking, setChecking] = useState(Updates.isEnabled && !__DEV__);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;

    async function updateBeforeUse() {
      if (!Updates.isEnabled || __DEV__ || !Updates.channel) {
        setChecking(false);
        return;
      }

      try {
        const update = await Updates.checkForUpdateAsync();
        if (!active) return;

        if (update.isAvailable) {
          setDownloading(true);
          await Updates.fetchUpdateAsync();
          if (active) await Updates.reloadAsync();
          return;
        }
      } catch {
        // Sin red o sin una actualización compatible: se abre la versión instalada.
      }

      if (active) setChecking(false);
    }

    void updateBeforeUse();
    return () => {
      active = false;
    };
  }, []);

  if (!checking) return children;

  return (
    <View
      accessibilityRole="progressbar"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 32,
        backgroundColor: c.bg,
      }}
    >
      <View style={{ padding: 22, borderRadius: 24, backgroundColor: c.pale }}>
        <Icon name={downloading ? "download-cloud" : "refresh-cw"} size={38} />
      </View>
      <Title>
        {downloading ? "Actualizando RAPICLINICS" : "Buscando mejoras"}
      </Title>
      <Body muted>
        {downloading
          ? "Instalando la versión más reciente de forma segura…"
          : "Esto tomará solo un momento."}
      </Body>
      <Loading />
    </View>
  );
}
