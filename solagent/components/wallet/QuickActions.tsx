import { Pressable, ScrollView, Text } from "react-native";
import { theme } from "../../constants/theme";

const actions = ["Send", "Swap", "Portfolio", "Automate"];

export function QuickActions({ onAction }: { onAction: (label: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
      {actions.map((action) => (
        <Pressable
          key={action}
          onPress={() => onAction(action)}
          style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderRadius: theme.radius.full, backgroundColor: theme.colors.background.card }}
        >
          <Text style={{ color: theme.colors.text.primary }}>{action}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
