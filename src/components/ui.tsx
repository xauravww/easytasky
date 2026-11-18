import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/** Role-based tokens for EasyTasky's restrained black/orange product theme. */
export const COLORS = {
  bg: "#141414",
  surface: "#1A1A1A",
  surfaceVariant: "#242424",
  surfaceInverse: "#F3F3F3",
  line: "#2A2A2A",
  ink: "#FFFFFF",
  muted: "#A6A6A6",
  primary: "#FA6E1E",
  onPrimary: "#FFFFFF",
  accent: "#FA6E1E",
  accentSoft: "rgba(250,110,30,0.14)",
  warn: "#E0A93B",
  warnSoft: "rgba(224,169,59,0.12)",
  danger: "#E5484D",
  dangerSoft: "rgba(229,72,77,0.12)",
  tint: "#1E1E1E",
};

export const readableTextOn = (hex: string): string => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return COLORS.ink;
  const values = [0, 2, 4].map(
    (offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255
  );
  const linear = values.map((value) =>
    value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  );
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const darkContrast = (luminance + 0.05) / 0.057;
  const lightContrast = 1.05 / (luminance + 0.05);
  return darkContrast >= lightContrast ? COLORS.onPrimary : COLORS.ink;
};

// Type ramp — fixed, tight ratio (product register: one family, system face).
export const TYPE = {
  display: 30,
  titleL: 22,
  title: 18,
  titleM: 16,
  body: 15,
  bodyM: 14,
  label: 13,
  labelM: 12,
};

// Spacing rhythm
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionTitle: { fontSize: TYPE.title, fontWeight: "700", color: COLORS.ink, marginBottom: 10 },
  btn: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  btnFilled: { backgroundColor: COLORS.primary },
  btnFilledText: { color: COLORS.onPrimary, fontWeight: "700", fontSize: TYPE.body },
  btnTonal: { backgroundColor: COLORS.surfaceVariant },
  btnTonalText: { color: COLORS.ink, fontWeight: "600", fontSize: TYPE.body },
  btnOutlined: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: COLORS.primary },
  btnOutlinedText: { color: COLORS.primary, fontWeight: "600", fontSize: TYPE.body },
  btnDisabled: { opacity: 0.45 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    marginRight: 8,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chipDefaultText: { fontSize: TYPE.label, fontWeight: "600", color: COLORS.muted },
  chipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  chipActiveText: { color: COLORS.primary },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    padding: 14,
    fontSize: TYPE.body,
    color: COLORS.ink,
    marginBottom: 12,
    minHeight: 48,
  },
});

export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <View style={[s.card, style]}>{children}</View>
);

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={s.sectionTitle}>{children}</Text>
);

type BtnKind = "primary" | "ghost" | "tonal" | "outlined" | "danger";
export const Button: React.FC<{
  onPress: () => void;
  title: string;
  kind?: BtnKind;
  icon?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}> = ({ onPress, title, kind = "primary", icon, disabled, size = "md", style }) => {
  const base =
    kind === "primary"
      ? s.btnFilled
      : kind === "outlined"
      ? s.btnOutlined
      : kind === "danger"
      ? { backgroundColor: COLORS.dangerSoft, borderWidth: 1, borderColor: COLORS.danger }
      : s.btnTonal;
  const textStyle =
    kind === "primary"
      ? s.btnFilledText
      : kind === "outlined"
      ? s.btnOutlinedText
      : kind === "danger"
      ? { color: COLORS.danger, fontWeight: "700" as const, fontSize: TYPE.body }
      : s.btnTonalText;

  const sizeStyle =
    size === "sm"
      ? { minHeight: 44, paddingHorizontal: 12, borderRadius: 12 }
      : size === "lg"
      ? { minHeight: 52, paddingHorizontal: 22, borderRadius: 16 }
      : {};

  const iconColor =
    kind === "primary" ? COLORS.onPrimary : kind === "danger" ? COLORS.danger : COLORS.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        s.btn,
        base,
        sizeStyle,
        style,
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        disabled && s.btnDisabled,
      ]}
    >
      {icon ? (
        <Ionicons name={icon as never} size={size === "sm" ? 15 : 18} color={iconColor} />
      ) : null}
      <Text style={[textStyle, size === "sm" && { fontSize: TYPE.label }]}>{title}</Text>
    </Pressable>
  );
};

export const IconButton: React.FC<{
  icon: string;
  onPress: () => void;
  size?: number;
  color?: string;
  bg?: string;
  border?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}> = ({
  icon,
  onPress,
  size = 20,
  color = COLORS.ink,
  bg = "transparent",
  border = false,
  disabled = false,
  style,
  accessibilityLabel,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled }}
    style={({ pressed }) => [
      {
        width: Math.max(44, size + 18),
        height: Math.max(44, size + 18),
        borderRadius: Math.max(44, size + 18) / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: border ? 1 : 0,
        borderColor: COLORS.line,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      },
      style,
    ]}
  >
    <Ionicons name={icon as never} size={size} color={color} />
  </Pressable>
);

export const Badge: React.FC<{
  count?: number | string;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ count, color = COLORS.onPrimary, bg = COLORS.accent, style }) => {
  if (count === undefined || count === null || count === "") return null;
  return (
    <View
      style={[
        {
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: bg,
          paddingHorizontal: 5,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 10, fontWeight: "700", color }}>{count}</Text>
    </View>
  );
};


export const Chip: React.FC<{ label: string; onPress?: () => void; active?: boolean }> = ({ label, onPress, active }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: !!active }}
    style={({ pressed }) => [s.chip, active && s.chipActive, pressed && { opacity: 0.8 }]}
  >
    <Text style={active ? s.chipActiveText : s.chipDefaultText}>{label}</Text>
  </Pressable>
);

export const Input: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  style?: StyleProp<TextStyle>;
}> = ({ value, onChangeText, placeholder, multiline, style }) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={COLORS.muted}
    multiline={multiline}
    style={[s.input, style]}
  />
);

export const ProgressBar: React.FC<{ fraction: number; color?: string }> = ({ fraction, color = COLORS.primary }) => (
  <View style={{ height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceVariant, overflow: "hidden" }}>
    <View
      style={{
        height: 8,
        width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
        backgroundColor: color,
        borderRadius: 4,
      }}
    />
  </View>
);

export const EmptyState: React.FC<{ text: string; hint?: string }> = ({ text, hint }) => (
  <View style={{ paddingVertical: 18 }}>
    <Text style={{ textAlign: "center", color: COLORS.ink, fontWeight: "600", fontSize: TYPE.bodyM }}>
      {text}
    </Text>
    {hint ? (
      <Text style={{ textAlign: "center", color: COLORS.muted, fontSize: TYPE.label, marginTop: 4 }}>{hint}</Text>
    ) : null}
  </View>
);

export const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ScrollView
    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    style={{ backgroundColor: COLORS.bg, flex: 1 }}
    keyboardShouldPersistTaps="handled"
  >
    {children}
  </ScrollView>
);

export const Spinner: React.FC = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <ActivityIndicator size="large" color={COLORS.primary} />
  </View>
);

export const Pill: React.FC<{ children: React.ReactNode; color?: string; bg?: string }> = ({ children, color, bg }) => (
  <View
    style={{
      alignSelf: "flex-start",
      backgroundColor: bg ?? COLORS.accentSoft,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      marginBottom: 6,
    }}
  >
    <Text style={{ fontSize: TYPE.labelM, fontWeight: "700", color: color ?? COLORS.primary }}>{children}</Text>
  </View>
);
