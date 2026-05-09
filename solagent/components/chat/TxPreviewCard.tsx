import { Text, View } from "react-native";
import { theme } from "../../constants/theme";
import type { TxPreview } from "../../types/chat";
import { formatSol, formatUsd } from "../../utils/formatters";

export function TxPreviewCard({ preview }: { preview: TxPreview }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border.accent,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.background.card,
      }}
    >
      <Text style={{ color: theme.colors.text.primary, marginBottom: theme.spacing.sm }}>Transaction Preview</Text>
      <Text style={{ color: theme.colors.text.secondary }}>Amount: {formatSol(preview.amount)}</Text>
      <Text style={{ color: theme.colors.text.secondary }}>Value: {formatUsd(preview.usdValue)}</Text>
      <Text style={{ color: theme.colors.text.secondary }}>Estimated fee: {preview.estimatedFeeSol} SOL</Text>
    </View>
  );
}
