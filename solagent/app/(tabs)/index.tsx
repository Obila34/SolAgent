import { useEffect, useRef } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { ChatBubble } from "../../components/chat/ChatBubble";
import { ChatInput } from "../../components/chat/ChatInput";
import { ThinkingIndicator } from "../../components/chat/ThinkingIndicator";
import { BalanceCard } from "../../components/wallet/BalanceCard";
import { QuickActions } from "../../components/wallet/QuickActions";
import { WalletConnectBtn } from "../../components/wallet/WalletConnectBtn";
import { theme } from "../../constants/theme";
import { useChat } from "../../hooks/useChat";
import { useVoice } from "../../hooks/useVoice";
import { useWallet } from "../../hooks/useWallet";
import { formatUsd } from "../../utils/formatters";
import type { Message } from "../../types/chat";

function truncateAddress(address?: string): string {
  if (!address) return "-";
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function ActionPreviewCard({
  actionType,
  from,
  to,
  amount,
  amountUsd,
  feeSol,
  onConfirm,
  onCancel,
  loading,
}: {
  actionType: string;
  from: string;
  to?: string;
  amount: number;
  amountUsd: number;
  feeSol: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border.accent,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.background.card,
        marginVertical: theme.spacing.sm,
      }}
    >
      <Text style={{ color: theme.colors.accent.purpleLight, marginBottom: theme.spacing.xs }}>{actionType}</Text>
      <Text style={{ color: theme.colors.text.secondary }}>From: {truncateAddress(from)}</Text>
      <Text style={{ color: theme.colors.text.secondary }}>To: {truncateAddress(to)}</Text>
      <Text style={{ color: theme.colors.text.primary, marginTop: theme.spacing.sm }}>
        Amount: {amount} ({formatUsd(amountUsd)})
      </Text>
      <Text style={{ color: theme.colors.text.secondary }}>Estimated fee: {feeSol} SOL</Text>
      <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        <Pressable
          onPress={onConfirm}
          disabled={loading}
          style={{
            flex: 1,
            backgroundColor: theme.colors.accent.green,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
          }}
        >
          <Text style={{ color: theme.colors.background.primary, textAlign: "center" }}>{loading ? "Confirming..." : "Confirm"}</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          disabled={loading}
          style={{ flex: 1, backgroundColor: theme.colors.status.error, borderRadius: theme.radius.md, padding: theme.spacing.md }}
        >
          <Text style={{ color: theme.colors.text.primary, textAlign: "center" }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { messages, isThinking, sendMessage, pendingAction, confirmPendingAction, cancelPendingAction, streamedResponse } = useChat();
  const voice = useVoice();
  const wallet = useWallet();
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamedResponse, pendingAction]);

  const renderItem: ListRenderItem<Message> = ({ item }) => <ChatBubble message={item} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.primary }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={12}>
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.colors.text.primary, fontSize: 24, fontWeight: "700" }}>SolAgent</Text>
            <Text style={{ color: theme.colors.text.secondary }}>{truncateAddress(wallet.address ?? undefined)}</Text>
          </View>
          {wallet.isConnected ? <BalanceCard solBalance={wallet.solBalance} usdBalance={wallet.usdBalance} /> : <WalletConnectBtn onPress={() => void wallet.connect()} />}
          <QuickActions onAction={(label) => void sendMessage(label === "Portfolio" ? "What's my portfolio?" : `${label} tokens`)} />
        </View>

        {messages.length === 0 ? (
          <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }}>
            {["Check my balance", "Swap SOL to USDC", "Send tokens"].map((chip) => (
              <Pressable
                key={chip}
                onPress={() => void sendMessage(chip)}
                style={{ borderColor: theme.colors.border.default, borderWidth: 1, borderRadius: theme.radius.full, padding: theme.spacing.md }}
              >
                <Text style={{ color: theme.colors.text.primary }}>{chip}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList ref={listRef} style={{ flex: 1, paddingHorizontal: theme.spacing.lg }} data={messages} keyExtractor={(item) => item.id} renderItem={renderItem} />
        )}

        {streamedResponse ? (
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <ChatBubble message={{ id: "streaming", role: "agent", content: streamedResponse, createdAt: new Date().toISOString() }} />
          </View>
        ) : null}

        {pendingAction ? (
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <ActionPreviewCard
              actionType={pendingAction.type}
              from={pendingAction.fromAddress}
              to={pendingAction.toAddress}
              amount={pendingAction.amount}
              amountUsd={pendingAction.amountUsd}
              feeSol={pendingAction.estimatedFeeSol}
              onConfirm={() => void confirmPendingAction()}
              onCancel={cancelPendingAction}
              loading={isThinking}
            />
          </View>
        ) : null}

        {isThinking ? <ThinkingIndicator /> : null}
        {voice.isSpeaking ? <Text style={{ color: theme.colors.accent.green, textAlign: "center" }}>Speaking...</Text> : null}
        <ChatInput
          onSend={(value) => void sendMessage(value)}
          onVoicePress={async () => {
            if (voice.isRecording) {
              const text = await voice.stopRecordingAndTranscribe();
              if (text) await sendMessage(text);
              return;
            }
            await voice.startRecording();
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
