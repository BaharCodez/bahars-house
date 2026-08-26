// Named themes. Each id matches a `[data-theme="…"]` palette in globals.css.
export interface Theme {
  id: string;
  label: string;
  swatch: string; // representative colour for the picker
}

export const THEMES: Theme[] = [
  { id: "cottage", label: "Cottage", swatch: "#3f5a3c" },
  { id: "meadow", label: "Meadow", swatch: "#788a4f" },
  { id: "plantshop", label: "Plant Shop", swatch: "#6f8f4f" },
  { id: "sepia", label: "Sepia", swatch: "#a9713f" },
  { id: "cabin", label: "Cabin", swatch: "#cf9b53" },
  { id: "twilight", label: "Twilight", swatch: "#d98a52" },
  { id: "forest", label: "Forest", swatch: "#5c7a48" },
];

export const DEFAULT_THEME = "cottage";
