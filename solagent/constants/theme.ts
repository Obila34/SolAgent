export const theme = {
  colors: {
    background: {
      primary: "#0a0a0f",
      secondary: "#0f0c1e",
      card: "#13111f",
      overlay: "rgba(0,0,0,0.7)",
    },
    accent: {
      purple: "#7c3aed",
      purpleLight: "#a78bfa",
      green: "#14f195",
      greenDim: "rgba(20,241,149,0.15)",
    },
    text: {
      primary: "#f0eeff",
      secondary: "#9ca3af",
      muted: "#4b5563",
    },
    border: {
      default: "rgba(255,255,255,0.08)",
      accent: "rgba(139,92,246,0.3)",
    },
    status: {
      success: "#14f195",
      error: "#f87171",
      warning: "#fbbf24",
    },
  },
  fonts: {
    display: "SpaceMono",
    body: "DMSans",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
} as const;

export type AppTheme = typeof theme;
