// Conversation "chat theme" catalog — a per-conversation accent color pair
// applied only within that conversation's own chat panel (see Message.jsx),
// by overriding the --accent/--accent-deep CSS custom properties the rest
// of the app already reads for its own light/dark theming (index.css/
// App.css). Overriding them on a scoped wrapper instead of :root keeps the
// effect contained to that one conversation.
export const CONVERSATION_THEMES = [
  { id: "default", label: "Default", swatch: "#e96449" },
  { id: "ocean", label: "Ocean", accent: "#2f7bbf", accentDeep: "#235d8f", swatch: "#2f7bbf" },
  { id: "sunset", label: "Sunset", accent: "#e0692f", accentDeep: "#b34f22", swatch: "#e0692f" },
  { id: "forest", label: "Forest", accent: "#3f8f5f", accentDeep: "#2f6c47", swatch: "#3f8f5f" },
  { id: "grape", label: "Grape", accent: "#7c5cbf", accentDeep: "#5f439a", swatch: "#7c5cbf" },
  { id: "rose", label: "Rose", accent: "#d5527a", accentDeep: "#ac3c5f", swatch: "#d5527a" },
  { id: "slate", label: "Slate", accent: "#55606e", accentDeep: "#3d4650", swatch: "#55606e" },
];

export const themeById = (id) =>
  CONVERSATION_THEMES.find((theme) => theme.id === id) || CONVERSATION_THEMES[0];

// "default" has no accent override — it simply inherits whatever --accent
// the app's own light/dark theme already sets on :root.
export const themeCssVars = (id) => {
  const theme = themeById(id);
  if (!theme.accent) return {};
  return { "--accent": theme.accent, "--accent-deep": theme.accentDeep };
};
