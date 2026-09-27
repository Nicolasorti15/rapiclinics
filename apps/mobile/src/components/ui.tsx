import React, { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Patient } from "../types";

export const c = {
  bg: "#F1F5F3",
  white: "#FFFFFF",
  ink: "#142F35",
  muted: "#607579",
  teal: "#087C70",
  tealDark: "#075B55",
  pale: "#E2F1ED",
  mist: "#F7FAF8",
  line: "#DCE6E2",
  danger: "#B63D45",
  amber: "#9A6500",
  blue: "#2E6F95",
};
export type IconName = React.ComponentProps<typeof Feather>["name"];
export function Icon({
  name,
  size = 22,
  color = c.teal,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Feather
      name={name}
      size={size}
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
export function Label({ children }: PropsWithChildren) {
  return <Text style={s.eyebrow}>{children}</Text>;
}
export function Title({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={s.title}>
      {children}
    </Text>
  );
}
export function Body({
  children,
  muted = false,
}: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={[s.body, muted && { color: c.muted }]}>{children}</Text>;
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Badge({
  children,
  warn = false,
}: PropsWithChildren<{ warn?: boolean }>) {
  return (
    <View style={[s.badge, warn && { backgroundColor: "#FFF4DE" }]}>
      <Text style={[s.badgeText, warn && { color: c.amber }]}>{children}</Text>
    </View>
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  loading = false,
  disabled = false,
  icon,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: "#FCECEC" },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? c.teal : c.white} />
      ) : icon ? (
        <Icon
          name={icon}
          size={20}
          color={secondary ? c.teal : danger ? c.danger : c.white}
        />
      ) : null}
      <Text
        style={[
          s.buttonText,
          secondary && { color: c.teal },
          danger && { color: c.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#789096"
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 150, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[s.notice, error && { backgroundColor: "#FFF0EE" }]}
    >
      <Icon
        name={error ? "alert-circle" : "info"}
        color={error ? c.danger : c.teal}
        size={19}
      />
      <Text style={[s.noticeText, error && { color: c.danger }]}>{text}</Text>
    </View>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ padding: 30, alignItems: "center", gap: 12 }}>
      <Icon name="inbox" size={30} />
      <Text style={s.subtitle}>{title}</Text>
      <Text style={[s.body, { color: c.muted, textAlign: "center" }]}>
        {text}
      </Text>
    </View>
  );
}
export function PatientIdentity({ patient }: { patient: Patient }) {
  return (
    <View
      accessible
      accessibilityLabel={`${patient.name}. Cama ${patient.bed}. Servicio ${patient.service}. Documento ${patient.identifier}.`}
      style={s.identity}
    >
      <View style={s.avatar}>
        <Icon name="user" />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.subtitle}>{patient.name}</Text>
        <Text style={s.small}>{patient.identifier}</Text>
        <Text style={[s.small, { color: c.teal, fontWeight: "700" }]}>
          {patient.service}
        </Text>
      </View>
      <View style={s.bedBadge}>
        <Text style={s.bedBadgeLabel}>CAMA</Text>
        <Text style={s.bedBadgeValue}>{patient.bed}</Text>
      </View>
    </View>
  );
}
export function Page({
  children,
  footer,
  patient,
  safeTop = false,
}: PropsWithChildren<{
  footer?: React.ReactNode;
  patient?: Patient;
  safeTop?: boolean;
}>) {
  return (
    <SafeAreaView
      style={s.page}
      edges={
        safeTop
          ? ["top", "left", "right", "bottom"]
          : ["left", "right", "bottom"]
      }
    >
      <View pointerEvents="none" style={s.pageAccent} />
      {patient && (
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            width: "100%",
            maxWidth: 640,
            alignSelf: "center",
          }}
        >
          <PatientIdentity patient={patient} />
        </View>
      )}
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.pageContent}
      >
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 40, alignItems: "center" }}>
      <ActivityIndicator size="large" color={c.teal} />
    </View>
  );
}
export function RowLink({
  title,
  detail,
  icon,
  onPress,
}: {
  title: string;
  detail?: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.rowLink}>
      <View style={s.smallIcon}>
        <Icon name={icon} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.subtitle}>{title}</Text>
        {Boolean(detail) && <Text style={s.small}>{detail}</Text>}
      </View>
      <Icon name="chevron-right" size={18} color={c.muted} />
    </Pressable>
  );
}
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: c.bg, overflow: "hidden" },
  pageAccent: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#DFEFEB",
    top: -150,
    right: -90,
    opacity: 0.8,
  },
  pageContent: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 18,
    paddingBottom: 42,
  },
  title: {
    fontSize: 31,
    fontWeight: "800",
    color: c.ink,
    letterSpacing: -1.1,
    lineHeight: 37,
  },
  subtitle: { fontSize: 16, color: c.ink, fontWeight: "700", lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 23, color: c.ink },
  small: { fontSize: 12.5, color: c.muted, lineHeight: 18 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: c.teal,
    textTransform: "uppercase",
  },
  card: {
    padding: 20,
    backgroundColor: c.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E4EBE8",
    gap: 14,
    shadowColor: "#173D3A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  button: {
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: c.teal,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  secondary: {
    backgroundColor: "#EDF5F2",
    borderWidth: 1,
    borderColor: "#D6E7E3",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: c.white,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D5E2DE",
    backgroundColor: c.mist,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: c.ink,
    minHeight: 54,
  },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: c.ink },
  badge: {
    borderRadius: 999,
    backgroundColor: c.pale,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: c.teal,
    letterSpacing: 0.4,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: c.pale,
    padding: 14,
    borderRadius: 16,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 20, color: c.teal },
  identity: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 15,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 20,
    shadowColor: "#173D3A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 1,
  },
  bedBadge: {
    minWidth: 66,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: c.teal,
    alignItems: "center",
    gap: 2,
  },
  bedBadgeLabel: {
    color: "#D9F0EC",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  bedBadgeValue: { color: c.white, fontSize: 17, fontWeight: "800" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: c.pale,
    justifyContent: "center",
    alignItems: "center",
  },
  rowLink: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
  },
  smallIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: c.pale,
    alignItems: "center",
    justifyContent: "center",
  },
});
