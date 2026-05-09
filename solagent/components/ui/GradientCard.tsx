import type { ReactNode } from "react";
import { View } from "react-native";
import { theme } from "../../constants/theme";

export function GradientCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.background.card,
        borderWidth: 1,
        borderColor: theme.colors.border.accent,
        borderRadius: theme.radius.xl,
        padding: theme.spacing.lg,
      }}
    >
      {children}
    </View>
  );
}
