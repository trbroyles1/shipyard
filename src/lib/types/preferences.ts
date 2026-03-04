export const THEMES = [
  { value: "classic", label: "Classic" },
  { value: "brinjal", label: "Brinjal" },
  { value: "drydock", label: "Drydock" },
  { value: "bermude", label: "Bermude" },
  { value: "myrtille", label: "Myrtille" },
] as const;

export type Theme = (typeof THEMES)[number]["value"];

const THEME_VALUES = new Set(THEMES.map((theme) => theme.value));

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEME_VALUES.has(value as Theme);
}

export interface UserPreferences {
  warningHours: number;
  criticalHours: number;
  notifyNewMR: boolean;
  soundNewMR: boolean;
  notifyAssigned: boolean;
  notifyReadyToMerge: boolean;
  jiraBaseUrl: string;
  theme: Theme;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  warningHours: 10,
  criticalHours: 20,
  notifyNewMR: true,
  soundNewMR: true,
  notifyAssigned: true,
  notifyReadyToMerge: true,
  jiraBaseUrl: "",
  theme: "classic",
};
