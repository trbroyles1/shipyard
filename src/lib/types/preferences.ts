export type Theme = "classic";

export const THEMES: { value: Theme; label: string }[] = [
  { value: "classic", label: "Classic" },
];

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
