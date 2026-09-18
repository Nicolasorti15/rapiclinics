import React, { useState } from "react";
import { Modal, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, OfflineBanner, useAuth } from "./src/features/core";
import {
  ConfirmScreen,
  HistoryScreen,
  HomeScreen,
  LoginScreen,
  PatientScreen,
  PatientsScreen,
  PrivacyScreen,
  ScanScreen,
  SettingsScreen,
  TasksScreen,
  PatientTasksScreen,
} from "./src/features/screens";
import { VisitScreen } from "./src/features/visits/VisitScreen";
import {
  DocumentsScreen,
  DocumentScreen,
} from "./src/features/documents/DocumentScreens";
import { Button, c, Loading } from "./src/components/ui";
import type { Routes } from "./src/types";
import { LabsScreen } from "./src/features/labs/LabsScreen";

import {
  AdminScreen,
  RegisterPatientScreen,
  LinkNfcScreen,
  isAdmin,
} from "./src/features/admin/AdminScreens";

const Stack = createNativeStackNavigator<Routes>();
function Root() {
  const { session, ready } = useAuth();
  const [privacy, setPrivacy] = useState(false);
  if (!ready) return <Loading />;
  if (!session)
    return (
      <>
        <LoginScreen onPrivacy={() => setPrivacy(true)} />
        <Modal visible={privacy} onRequestClose={() => setPrivacy(false)}>
          <View style={{ flex: 1, paddingTop: 40 }}>
            <Button
              title="Cerrar"
              secondary
              onPress={() => setPrivacy(false)}
            />
            <PrivacyScreen />
          </View>
        </Modal>
      </>
    );
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: c.bg,
          primary: c.teal,
          card: c.bg,
          text: c.ink,
          border: c.line,
        },
      }}
    >
      <OfflineBanner />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShadowVisible: false,
          headerTitleStyle: { fontSize: 16, fontWeight: "600" },
          headerTintColor: c.teal,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        {isAdmin(session.user.role) && (
          <>
            <Stack.Screen
              name="Admin"
              component={AdminScreen}
              options={{ title: "Administración" }}
            />
            <Stack.Screen
              name="RegisterPatient"
              component={RegisterPatientScreen}
              options={{ title: "Registrar paciente" }}
            />
            <Stack.Screen
              name="LinkNfc"
              component={LinkNfcScreen}
              options={{ title: "Vincular NFC" }}
            />
          </>
        )}
        <Stack.Screen
          name="Labs"
          component={LabsScreen}
          options={{ title: "Resultados y gráficas" }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Patients"
          component={PatientsScreen}
          options={{ title: "Pacientes" }}
        />
        <Stack.Screen
          name="Tasks"
          component={TasksScreen}
          options={{ title: "Pendientes" }}
        />
        <Stack.Screen
          name="PatientTasks"
          component={PatientTasksScreen}
          options={{ title: "Pendientes del paciente" }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: "Mi cuenta" }}
        />
        <Stack.Screen
          name="Privacy"
          component={PrivacyScreen}
          options={{ title: "Privacidad" }}
        />
        <Stack.Screen
          name="Scan"
          component={ScanScreen}
          options={{ title: "Identificar paciente" }}
        />
        <Stack.Screen
          name="Confirm"
          component={ConfirmScreen}
          options={{ title: "Confirmar identidad" }}
        />
        <Stack.Screen
          name="Patient"
          component={PatientScreen}
          options={{ title: "Paciente" }}
        />
        <Stack.Screen
          name="Visit"
          component={VisitScreen}
          options={{ title: "Registrar visita", gestureEnabled: false }}
        />
        <Stack.Screen
          name="Documents"
          component={DocumentsScreen}
          options={{ title: "Documentos" }}
        />
        <Stack.Screen
          name="Document"
          component={DocumentScreen}
          options={{ title: "Revisar documento" }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: "Historial" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
