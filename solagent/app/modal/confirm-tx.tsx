import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { theme } from "../../constants/theme";
import { executeConfirmedAction, type PendingAction } from "../../services/claude";
import { formatUsd } from "../../utils/formatters";

type ConfirmParams = {
  action?: string;
};

function truncateAddress(address?: string): string {
  if (!address) return "-";
  return address.length <= 10 ? address : `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getBadgeConfig(action: PendingAction): { label: string; color: string } {
  if (action.type === "send_sol") return { label: "SEND", color: theme.colors.accent.purpleLight };
  if (action.type === "swap_tokens") return { label: "SWAP", color: theme.colors.status.warning };
  return { label: "SEND TOKEN", color: theme.colors.accent.green };
}

function getDisplaySymbol(action: PendingAction): string {
  if (action.type === "swap_tokens") return `${action.inputMint ?? "TOKEN"} -> ${action.outputMint ?? "TOKEN"}`;
  if (action.type === "send_sol") return "SOL";
  return action.mintAddress ?? "TOKEN";
}

function getPriceImpactInfo(action: PendingAction): { level: "none" | "warning" | "danger"; text: string; color: string } {
  if (action.type !== "swap_tokens" || !action.quote?.priceImpactPct) {
    return { level: "none", text: "", color: "transparent" };
  }
  const impact = Number(action.quote.priceImpactPct);
  if (impact > 3) {
    return { level: "danger", text: `High price impact: ${impact.toFixed(2)}%`, color: theme.colors.status.error };
  }
  if (impact > 1) {
    return { level: "warning", text: `Price impact warning: ${impact.toFixed(2)}%`, color: theme.colors.status.warning };
  }
  return { level: "none", text: "", color: "transparent" };
}

function parseAction(raw: string | undefined): PendingAction | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingAction;
    if (!parsed.type || !parsed.fromAddress || typeof parsed.amount !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractSignature(result: string): string {
  const matches = result.match(/[1-9A-HJ-NP-Za-km-z]{43,88}/g);
  return matches?.[0] ?? result;
}

export default function ConfirmTxModal() {
  const router = useRouter();
  const params = useLocalSearchParams<ConfirmParams>();
  const action = useMemo(() => parseAction(params.action), [params.action]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scale = useSharedValue(0.95);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
  }, [scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const badge = useMemo(() => (action ? getBadgeConfig(action) : { label: "UNKNOWN", color: theme.colors.text.muted }), [action]);
  const symbol = useMemo(() => (action ? getDisplaySymbol(action) : "-"), [action]);
  const priceImpact = useMemo(() => (action ? getPriceImpactInfo(action) : { level: "none", text: "", color: "transparent" }), [action]);

  const amountUsd = action?.amountUsd ?? 0;
  const feeSol = action?.estimatedFeeSol ?? 0;
  const feeUsd = feeSol * 160;

  async function onCopy(value?: string): Promise<void> {
    if (!value) return;
    await Clipboard.setStringAsync(value);
  }

  async function onConfirm(): Promise<void> {
    if (!action) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await executeConfirmedAction(action);
      const signature = extractSignature(result);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.replace({
        pathname: "/(tabs)",
        params: {
          status: "confirmed",
          signature,
        },
      });
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage("The transaction didn't go through. Want me to try again?");
      setIsSubmitting(false);
    }
  }

  function onCancel(): void {
    router.replace({
      pathname: "/(tabs)",
      params: { status: "cancelled" },
    });
  }

  if (!action) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.primary, padding: theme.spacing.lg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.status.error }}>Invalid action payload.</Text>
          <Pressable onPress={onCancel} style={{ backgroundColor: theme.colors.background.card, borderRadius: theme.radius.full, padding: theme.spacing.md }}>
            <Text style={{ color: theme.colors.text.primary }}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.primary, padding: theme.spacing.lg }}>
      <Animated.View style={[{ flex: 1, justifyContent: "space-between" }, animatedStyle]}>
        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.text.primary, fontSize: 24, fontWeight: "700" }}>Confirm Transaction</Text>

          <View style={{ alignSelf: "flex-start", backgroundColor: badge.color, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.background.primary, fontWeight: "700" }}>{badge.label}</Text>
          </View>

          <Pressable onPress={() => void onCopy(action.fromAddress)}>
            <Text style={{ color: theme.colors.text.secondary }}>From: {truncateAddress(action.fromAddress)}</Text>
          </Pressable>

          <Pressable onPress={() => void onCopy(action.toAddress)}>
            <Text style={{ color: theme.colors.text.secondary }}>To: {truncateAddress(action.toAddress)}</Text>
          </Pressable>

          <View style={{ marginTop: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.text.primary, fontSize: 36, fontWeight: "700" }}>
              {action.amount} {symbol}
            </Text>
            <Text style={{ color: theme.colors.text.secondary }}>{formatUsd(amountUsd)}</Text>
          </View>

          <Text style={{ color: theme.colors.text.secondary }}>
            Estimated network fee: {feeSol.toFixed(6)} SOL ({formatUsd(feeUsd)})
          </Text>

          {priceImpact.level !== "none" ? <Text style={{ color: priceImpact.color, fontWeight: "600" }}>{priceImpact.text}</Text> : null}

          {errorMessage ? (
            <View style={{ backgroundColor: "rgba(248,113,113,0.15)", borderColor: theme.colors.status.error, borderWidth: 1, borderRadius: theme.radius.md, padding: theme.spacing.md }}>
              <Text style={{ color: theme.colors.status.error }}>{errorMessage}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Pressable
            onPress={() => void onConfirm()}
            disabled={isSubmitting}
            style={{
              backgroundColor: "#14F195",
              borderRadius: theme.radius.full,
              padding: theme.spacing.md,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: theme.spacing.sm,
            }}
          >
            {isSubmitting ? <ActivityIndicator color={theme.colors.background.primary} /> : null}
            <Text style={{ color: theme.colors.background.primary, fontWeight: "700" }}>Confirm</Text>
          </Pressable>

          <Pressable onPress={onCancel} disabled={isSubmitting} style={{ backgroundColor: theme.colors.status.error, borderRadius: theme.radius.full, padding: theme.spacing.md }}>
            <Text style={{ color: theme.colors.text.primary, textAlign: "center", fontWeight: "700" }}>Cancel</Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
