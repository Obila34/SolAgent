import * as WebBrowser from "expo-web-browser";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, Text, View } from "react-native";
import { theme } from "../../constants/theme";
import { getTransactionHistory } from "../../services/solana";
import { useWalletStore } from "../../store/walletStore";
import type { EnrichedTransaction } from "../../services/solana";
import { formatSol, shortHash } from "../../utils/formatters";

type SectionTitle = "Today" | "Yesterday" | "This Week" | "Earlier";

interface HistorySection {
  title: SectionTitle;
  data: EnrichedTransaction[];
}

function getSectionTitle(timestampSeconds: number): SectionTitle {
  const txDate = new Date(timestampSeconds * 1000);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffMs = now.getTime() - txDate.getTime();
  if (diffMs < dayMs) return "Today";
  if (diffMs < dayMs * 2) return "Yesterday";
  if (diffMs < dayMs * 7) return "This Week";
  return "Earlier";
}

function getTxIcon(tx: EnrichedTransaction): string {
  if (tx.type.toLowerCase().includes("swap")) return "⇄";
  if (tx.type.toLowerCase().includes("send")) return "↑";
  if (tx.type.toLowerCase().includes("receive")) return "↓";
  return "?";
}

function getTxColor(tx: EnrichedTransaction): string {
  if (tx.type.toLowerCase().includes("swap")) return theme.colors.accent.purpleLight;
  if (tx.type.toLowerCase().includes("send")) return theme.colors.status.error;
  if (tx.type.toLowerCase().includes("receive")) return theme.colors.status.success;
  return theme.colors.text.secondary;
}

function deriveAmountLabel(tx: EnrichedTransaction): string {
  if (tx.nativeTransfers.length > 0) return `${formatSol(tx.nativeTransfers[0].amountSol)}`;
  if (tx.tokenTransfers.length > 0) return `${tx.tokenTransfers[0].amount} ${tx.tokenTransfers[0].symbol}`;
  return "0";
}

export default function HistoryScreen() {
  const address = useWalletStore((state) => state.address);
  const [history, setHistory] = useState<EnrichedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);

  const fetchHistory = useCallback(
    async (nextLimit: number, append = false): Promise<void> => {
      if (!address) return;
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);
      try {
        const txs = await getTransactionHistory(address, nextLimit);
        setHistory(txs);
      } catch {
        setError("Check your connection");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [address],
  );

  useEffect(() => {
    void fetchHistory(limit, false);
  }, [fetchHistory, limit]);

  const sections = useMemo<HistorySection[]>(() => {
    const grouped: Record<SectionTitle, EnrichedTransaction[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: [],
    };
    for (const tx of history) grouped[getSectionTitle(tx.timestamp)].push(tx);
    return (Object.keys(grouped) as SectionTitle[])
      .map((title) => ({ title, data: grouped[title] }))
      .filter((section) => section.data.length > 0);
  }, [history]);

  if (isLoading && history.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background.primary, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#9945FF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background.primary, padding: theme.spacing.lg }}>
      {error ? (
        <Pressable
          onPress={() => void fetchHistory(limit, false)}
          style={{ marginBottom: theme.spacing.md, backgroundColor: theme.colors.background.card, borderRadius: theme.radius.md, padding: theme.spacing.md }}
        >
          <Text style={{ color: theme.colors.status.error }}>{error} - Tap to retry</Text>
        </Pressable>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.signature}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={{ color: theme.colors.text.secondary, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(`https://explorer.solana.com/tx/${item.signature}`)}
            style={{ marginBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border.default, paddingBottom: theme.spacing.sm }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: getTxColor(item), fontSize: 18 }}>{getTxIcon(item)}</Text>
              <Text style={{ color: theme.colors.text.primary, flex: 1, marginLeft: theme.spacing.sm }}>{item.description}</Text>
              <Text style={{ color: theme.colors.text.secondary }}>{deriveAmountLabel(item)}</Text>
            </View>
            <Text style={{ color: theme.colors.text.secondary, marginTop: theme.spacing.xs }}>
              {formatDistanceToNow(new Date(item.timestamp * 1000), { addSuffix: true })} - {shortHash(item.signature, 6)}
            </Text>
          </Pressable>
        )}
        onEndReached={() => {
          if (isLoadingMore) return;
          setLimit((current) => current + 20);
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={isLoadingMore ? <ActivityIndicator color="#9945FF" /> : null}
      />
    </View>
  );
}
