import { Tabs } from "expo-router";
import { theme } from "../../constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background.primary },
        headerTintColor: theme.colors.text.primary,
        tabBarStyle: { backgroundColor: theme.colors.background.card, borderTopColor: theme.colors.border.default },
        tabBarActiveTintColor: theme.colors.accent.purpleLight,
        tabBarInactiveTintColor: theme.colors.text.secondary,
      }}
    />
  );
}
