import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { theme } from "../../constants/theme";
import { useWallet } from "../../hooks/useWallet";
import { useSettingsStore } from "../../store/settingsStore";

export default function SettingsScreen() {
  const wallet = useWallet();
  const settings = useSettingsStore();

  const sectionStyle = {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  } as const;

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }} style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
      <Text style={{ color: theme.colors.text.primary, fontSize: 22, fontWeight: "700" }}>Settings</Text>

      <View style={sectionStyle}>
        <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>Wallet</Text>
        <Pressable onPress={() => void Clipboard.setStringAsync(wallet.address ?? "")}>
          <Text style={{ color: theme.colors.text.secondary }}>{wallet.address ?? "Not connected"}</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Alert.alert("Disconnect Wallet", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Disconnect", style: "destructive", onPress: () => void wallet.disconnect() },
            ])
          }
          style={{ backgroundColor: theme.colors.status.error, padding: theme.spacing.sm, borderRadius: theme.radius.md }}
        >
          <Text style={{ color: theme.colors.text.primary, textAlign: "center" }}>Disconnect Wallet</Text>
        </Pressable>
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>AI Agent</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.colors.text.secondary }}>Pay per AI Query (0.001 SOL)</Text>
          <Switch value={settings.x402Enabled} onValueChange={settings.setX402Enabled} />
        </View>
        <Text style={{ color: theme.colors.text.secondary }}>
          Total Queries: {settings.totalQueries} | Total Spent: {settings.totalSpentSol.toFixed(3)} SOL
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.colors.text.secondary }}>Voice responses</Text>
          <Switch value={settings.voiceEnabled} onValueChange={settings.setVoiceEnabled} />
        </View>
        <Text style={{ color: theme.colors.text.secondary }}>Language: {settings.language}</Text>
        <Pressable onPress={() => settings.setLanguage(settings.language === "English" ? "Spanish" : "English")}>
          <Text style={{ color: theme.colors.accent.purpleLight }}>Toggle Language</Text>
        </Pressable>
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>Network</Text>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <Pressable
            onPress={() => settings.setNetwork("mainnet-beta")}
            style={{ backgroundColor: settings.network === "mainnet-beta" ? theme.colors.accent.purple : theme.colors.background.secondary, padding: theme.spacing.sm, borderRadius: theme.radius.md }}
          >
            <Text style={{ color: theme.colors.text.primary }}>Mainnet</Text>
          </Pressable>
          <Pressable
            onPress={() => settings.setNetwork("devnet")}
            style={{ backgroundColor: settings.network === "devnet" ? theme.colors.accent.purple : theme.colors.background.secondary, padding: theme.spacing.sm, borderRadius: theme.radius.md }}
          >
            <Text style={{ color: theme.colors.text.primary }}>Devnet</Text>
          </Pressable>
        </View>
        <TextInput
          value={settings.customRpcUrl}
          onChangeText={settings.setCustomRpcUrl}
          placeholder="Custom RPC URL"
          placeholderTextColor={theme.colors.text.muted}
          style={{ borderWidth: 1, borderColor: theme.colors.border.default, color: theme.colors.text.primary, borderRadius: theme.radius.md, padding: theme.spacing.sm }}
        />
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>Notifications</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.colors.text.secondary }}>Balance change alerts</Text>
          <Switch value={settings.balanceAlertsEnabled} onValueChange={settings.setBalanceAlertsEnabled} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.colors.text.secondary }}>Large transaction alerts (&gt; 1 SOL)</Text>
          <Switch value={settings.largeTxAlertsEnabled} onValueChange={settings.setLargeTxAlertsEnabled} />
        </View>
      </View>

      <View style={sectionStyle}>
        <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>About</Text>
        <Text style={{ color: theme.colors.text.secondary }}>Version 1.0.0</Text>
        <Pressable onPress={() => void Linking.openURL("https://github.com/")}>
          <Text style={{ color: theme.colors.accent.purpleLight }}>View on GitHub</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text.secondary }}>Built for Dev3pack Hackathon 2026</Text>
      </View>
    </ScrollView>
  );
}
