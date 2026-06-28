import { createTheme } from "@mui/material/styles";

/**
 * @module theme/theme
 * @description Tema MUI compartilhado por toda a aplicação.
 *
 * PATTERN: Provider/Theme (design tokens centralizados)
 * Por que este pattern: cor, tipografia e densidade ficam num único lugar, em vez de
 * espalhadas em CSS por componente (como era em `styles.css`). Todo componente MUI lê
 * daqui via `ThemeProvider`.
 *
 * Responsabilidade: definir paleta (dark), tipografia e overrides leves de densidade.
 * Não faz: estilo de componentes individuais (cada componente usa `sx`/props do MUI),
 * nem o tema do AG Grid (esse vem do CSS `ag-theme-quartz-dark`).
 */
export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#f7931a" }, // laranja bitcoin
    background: { default: "#0d1117", paper: "#161b22" },
    success: { main: "#1f9d55" },
    warning: { main: "#e0a800" },
    error: { main: "#d33a3a" },
  },
  typography: {
    fontFamily: "system-ui, sans-serif",
    h1: { fontSize: "1.5rem", fontWeight: 700 },
    h2: { fontSize: "1.1rem", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
});
