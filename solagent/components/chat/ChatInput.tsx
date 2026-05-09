import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { theme } from "../../constants/theme";

interface ChatInputProps {
  onSend: (message: string) => void;
  onVoicePress: () => void;
}

export function ChatInput({ onSend, onVoicePress }: ChatInputProps) {
  const [value, setValue] = useState("");

  return (
    <View style={{ flexDirection: "row", gap: theme.spacing.sm, padding: theme.spacing.md }}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Ask SolAgent anything..."
        placeholderTextColor={theme.colors.text.muted}
        style={{
          flex: 1,
          color: theme.colors.text.primary,
          borderColor: theme.colors.border.default,
          borderWidth: 1,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        }}
      />
      <Pressable
        onPress={() => {
          if (!value.trim()) return;
          onSend(value.trim());
          setValue("");
        }}
        style={{ backgroundColor: theme.colors.accent.purple, borderRadius: theme.radius.full, padding: theme.spacing.md }}
      >
        <Text style={{ color: theme.colors.text.primary }}>Send</Text>
      </Pressable>
      <Pressable onPress={onVoicePress} style={{ padding: theme.spacing.md }}>
        <Text style={{ color: theme.colors.accent.green }}>Mic</Text>
      </Pressable>
    </View>
  );
}
