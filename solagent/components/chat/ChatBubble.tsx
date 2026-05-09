import { Text, View } from "react-native";
import { theme } from "../../constants/theme";
import type { Message } from "../../types/chat";

export function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <View
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        backgroundColor: isUser ? theme.colors.accent.purple : theme.colors.background.card,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
        marginVertical: theme.spacing.xs,
        maxWidth: "84%",
      }}
    >
      <Text style={{ color: theme.colors.text.primary }}>{message.content}</Text>
    </View>
  );
}
