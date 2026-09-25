import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Icon, Label, c, s } from "../../components/ui";
import {
  MIN_BIRTH_YEAR,
  calendarDays,
  formatBirthDate,
  parseIsoDate,
  toIsoDate,
} from "./birthDate";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const WEEK = ["L", "M", "M", "J", "V", "S", "D"];

export function BirthDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const selected = parseIsoDate(value);
  const initial =
    selected ?? new Date(today.getFullYear() - 30, today.getMonth(), 1, 12);
  const [visible, setVisible] = useState(false);
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const days = calendarDays(year, month);

  const changeMonth = (amount: number) => {
    const next = new Date(year, month + amount, 1, 12);
    if (
      next.getFullYear() < MIN_BIRTH_YEAR ||
      next > new Date(today.getFullYear(), today.getMonth(), 1, 12)
    )
      return;
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };
  const changeYear = (amount: number) => {
    setYear((current) => {
      const next = Math.max(
        MIN_BIRTH_YEAR,
        Math.min(today.getFullYear(), current + amount),
      );
      if (next === today.getFullYear() && month > today.getMonth())
        setMonth(today.getMonth());
      return next;
    });
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.fieldLabel}>Fecha de nacimiento</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Seleccionar fecha de nacimiento"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.75 }]}
      >
        <Icon name="calendar" size={20} />
        <Text style={[styles.fieldText, !value && { color: "#789096" }]}>
          {value ? formatBirthDate(value) : "Seleccionar en el calendario"}
        </Text>
        <Icon name="chevron-down" size={18} color={c.muted} />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Label>FECHA DE NACIMIENTO</Label>
            <View style={styles.yearControls}>
              <Pressable
                accessibilityLabel="Retroceder diez años"
                style={styles.compact}
                onPress={() => changeYear(-10)}
              >
                <Text style={styles.compactText}>−10</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Año anterior"
                style={styles.compact}
                onPress={() => changeYear(-1)}
              >
                <Icon name="chevron-left" size={18} />
              </Pressable>
              <Text style={styles.year}>{year}</Text>
              <Pressable
                accessibilityLabel="Año siguiente"
                style={styles.compact}
                onPress={() => changeYear(1)}
              >
                <Icon name="chevron-right" size={18} />
              </Pressable>
              <Pressable
                accessibilityLabel="Avanzar diez años"
                style={styles.compact}
                onPress={() => changeYear(10)}
              >
                <Text style={styles.compactText}>+10</Text>
              </Pressable>
            </View>
            <View style={styles.monthControls}>
              <Pressable
                accessibilityLabel="Mes anterior"
                onPress={() => changeMonth(-1)}
                style={styles.arrow}
              >
                <Icon name="chevron-left" />
              </Pressable>
              <Text style={styles.month}>{MONTHS[month]}</Text>
              <Pressable
                accessibilityLabel="Mes siguiente"
                onPress={() => changeMonth(1)}
                style={styles.arrow}
              >
                <Icon name="chevron-right" />
              </Pressable>
            </View>
            <View style={styles.grid}>
              {WEEK.map((label, index) => (
                <Text key={`${label}-${index}`} style={styles.weekday}>
                  {label}
                </Text>
              ))}
              {days.map((day, index) => {
                if (!day)
                  return <View key={`empty-${index}`} style={styles.day} />;
                const candidate = new Date(year, month, day, 12);
                const disabled = candidate > today;
                const active =
                  selected?.getFullYear() === year &&
                  selected.getMonth() === month &&
                  selected.getDate() === day;
                return (
                  <Pressable
                    key={day}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} de ${MONTHS[month]} de ${year}`}
                    onPress={() => {
                      onChange(toIsoDate(year, month, day));
                      setVisible(false);
                    }}
                    style={[styles.day, active && styles.activeDay]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        disabled && { color: c.line },
                        active && { color: c.white, fontWeight: "800" },
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Body muted>Las fechas futuras están bloqueadas.</Body>
            <Button
              title="Cerrar calendario"
              secondary
              onPress={() => setVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#A6BABC",
    borderRadius: 12,
    backgroundColor: c.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fieldText: { flex: 1, fontSize: 16, color: c.ink },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 38, 44, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    backgroundColor: c.white,
    borderRadius: 22,
    padding: 20,
    gap: 14,
  },
  yearControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  compact: {
    width: 42,
    height: 40,
    borderRadius: 10,
    backgroundColor: c.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  compactText: { color: c.teal, fontWeight: "700" },
  year: {
    flex: 1,
    textAlign: "center",
    fontSize: 19,
    fontWeight: "800",
    color: c.ink,
  },
  monthControls: { flexDirection: "row", alignItems: "center" },
  arrow: { padding: 8 },
  month: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: c.ink,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: {
    width: "14.2857%",
    textAlign: "center",
    color: c.muted,
    fontWeight: "700",
    paddingVertical: 8,
  },
  day: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  dayText: { color: c.ink, fontSize: 15 },
  activeDay: { backgroundColor: c.teal },
});
