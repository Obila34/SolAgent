import { Text, View } from "react-native";
import { theme } from "../../constants/theme";
import { formatSol, formatUsd } from "../../utils/formatters";

export function BalanceCard({ solBalance, usdBalance }: { solBalance: number; usdBalance: number }) {
  return (
    <View style={{ backgroundColor: theme.colors.background.card, borderRadius: theme.radius.xl, padding: theme.spacing.xl }}>
      <Text style={{ color: theme.colors.text.secondary }}>Wallet Balance</Text>
      <Text style={{ color: theme.colors.text.primary, fontSize: 28, marginTop: theme.spacing.sm }}>{formatSol(solBalance)}</Text>
      <Text style={{ color: theme.colors.accent.green }}>{formatUsd(usdBalance)}</Text>
    </View>
  );
}
