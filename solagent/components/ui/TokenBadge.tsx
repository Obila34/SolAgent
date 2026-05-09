import { Text, View } from "react-native";
import { theme } from "../../constants/theme";

export function TokenBadge({ symbol }: { symbol: string }) {
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: theme.colors.background.secondary, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs }}>
      <Text style={{ color: theme.colors.text.primary }}>{symbol}</Text>
    </View>
  );
}
