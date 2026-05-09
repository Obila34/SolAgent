import { ActivityIndicator, View } from "react-native";
import { theme } from "../../constants/theme";

export function ThinkingIndicator() {
  return (
    <View style={{ paddingVertical: theme.spacing.sm }}>
      <ActivityIndicator color={theme.colors.accent.purpleLight} />
    </View>
  );
}
