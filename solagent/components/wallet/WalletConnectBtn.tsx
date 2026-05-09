import { Pressable, Text } from "react-native";
import { theme } from "../../constants/theme";

export function WalletConnectBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: theme.colors.accent.purple, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md }}
    >
      <Text style={{ color: theme.colors.text.primary, fontWeight: "700" }}>Connect Wallet</Text>
    </Pressable>
  );
}
