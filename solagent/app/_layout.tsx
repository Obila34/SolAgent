import { Buffer } from "buffer";

global.Buffer = Buffer;

import "react-native-get-random-values";

import { Stack } from "expo-router";
import { theme } from "../constants/theme";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background.primary },
        headerTintColor: theme.colors.text.primary,
        contentStyle: { backgroundColor: theme.colors.background.primary },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal/confirm-tx" options={{ presentation: "modal", title: "Confirm Transaction" }} />
    </Stack>
  );
}
