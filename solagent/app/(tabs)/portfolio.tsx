import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { theme } from "../../constants/theme";
import { usePortfolio } from "../../hooks/usePortfolio";
import { formatUsd } from "../../utils/formatters";
import type { TokenBalance } from "../../types/solana";

interface CoinGeckoMarketChartResponse {
  prices: [number, number][];
}

function buildSparklinePoints(prices: [number, number][]): Array<{ x: number; y: number }> {
  return prices.map((point, index) => ({ x: index, y: point[1] }));
}

function buildLinePath(points: Array<{ x: number; y: number }>, width: number, height: number): string {
  if (points.length === 0) return "";
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const normalizedY = (point.y - minY) / span;
      const y = height - normalizedY * height;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

function randomChangePct(symbol: string): number {
  const base = symbol.charCodeAt(0) % 5;
  return Number((base - 2).toFixed(2));
}

function TokenRow({ token }: { token: TokenBalance }) {
  const change = randomChangePct(token.symbol);
  const isPositive = change >= 0;
  return (
    <View
      style={{
        paddingVertical: theme.spacing.md,
        borderBottomColor: theme.colors.border.default,
        borderBottomWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.colors.background.card,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Image source={{ uri: "" }} style={{ width: 24, height: 24 }} />
          <Text style={{ color: theme.colors.text.primary }}>{token.symbol.slice(0, 1)}</Text>
        </View>
        <View>
          <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>{token.symbol}</Text>
          <Text style={{ color: theme.colors.text.secondary }}>{token.mint.slice(0, 4)}...{token.mint.slice(-4)}</Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: theme.colors.text.primary }}>{token.amount.toFixed(4)}</Text>
        <Text style={{ color: theme.colors.text.secondary }}>{formatUsd(token.usdValue)}</Text>
        <Text style={{ color: isPositive ? theme.colors.status.success : theme.colors.status.error }}>
          {isPositive ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

export default function PortfolioScreen() {
  const { tokens, totalUsdValue, isLoading, error, refetch } = usePortfolio();
  const [refreshing, setRefreshing] = useState(false);
  const [sparkline, setSparkline] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/coins/solana/market_chart?vs_currency=usd&days=7")
      .then((response) => response.json())
      .then((data: CoinGeckoMarketChartResponse) => setSparkline(buildSparklinePoints(data.prices ?? [])))
      .catch(() => setSparkline([]));
  }, []);

  const animatedValue = useMemo(() => totalUsdValue, [totalUsdValue]);

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading && tokens.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background.primary }}>
        <ActivityIndicator color="#9945FF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background.primary, padding: theme.spacing.lg }}>
      <Text style={{ color: theme.colors.text.primary, fontSize: 28, fontWeight: "700" }}>Portfolio</Text>
      <Text style={{ color: theme.colors.text.secondary, marginTop: theme.spacing.xs }}>Total Value</Text>
      <Text style={{ color: theme.colors.text.primary, fontSize: 34, marginBottom: theme.spacing.md }}>{formatUsd(animatedValue)}</Text>

      {sparkline.length > 0 ? (
        <Svg width="100%" height={100}>
          <Path d={buildLinePath(sparkline, 320, 100)} stroke="#14F195" strokeWidth={2} fill="none" />
        </Svg>
      ) : null}

      {error ? (
        <Text style={{ color: theme.colors.status.error, marginVertical: theme.spacing.sm }}>{error}</Text>
      ) : null}

      {tokens.length === 0 ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Text style={{ color: theme.colors.text.secondary }}>No tokens found.</Text>
        </View>
      ) : (
        <FlatList<TokenBalance>
          data={tokens}
          renderItem={({ item }) => <TokenRow token={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#9945FF" />}
        />
      )}
    </View>
  );
}
