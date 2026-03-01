"use client";

import { useCallback } from "react";
import { Modal } from "@/components/shared/Modal";
import { usePreferencesContext } from "@/components/providers/PreferencesProvider";
import { THEMES, type UserPreferences, type Theme } from "@/lib/types/preferences";
import styles from "./PreferencesModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.toggleLabel}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.toggleKnob} />
      </button>
    </label>
  );
}

export function PreferencesModal({ open, onClose }: Props) {
  const { preferences, updatePreferences } = usePreferencesContext();

  const update = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      updatePreferences({ [key]: value });
    },
    [updatePreferences],
  );

  return (
    <Modal open={open} onClose={onClose} title="Preferences" width={400}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Theme</h3>
        <div className={styles.themeSelect}>
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`${styles.themeOption} ${preferences.theme === t.value ? styles.themeActive : ""}`}
              onClick={() => update("theme", t.value as Theme)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>MR Age Thresholds</h3>
        <p className={styles.sectionDesc}>
          Tint MR cards based on how long they have been open.
        </p>
        <div className={styles.inputRow}>
          <label className={styles.inputLabel}>
            Warning after
            <div className={styles.inputWrap}>
              <input
                type="number"
                min={0}
                value={preferences.warningHours}
                onChange={(e) => update("warningHours", Math.max(0, Number(e.target.value)))}
                className={styles.numberInput}
              />
              <span className={styles.inputSuffix}>hours</span>
            </div>
          </label>
          <label className={styles.inputLabel}>
            Critical after
            <div className={styles.inputWrap}>
              <input
                type="number"
                min={0}
                value={preferences.criticalHours}
                onChange={(e) => update("criticalHours", Math.max(0, Number(e.target.value)))}
                className={styles.numberInput}
              />
              <span className={styles.inputSuffix}>hours</span>
            </div>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Notifications</h3>
        <Toggle
          label="Toast on new MR"
          checked={preferences.notifyNewMR}
          onChange={(v) => update("notifyNewMR", v)}
        />
        <Toggle
          label="Sound on new MR"
          checked={preferences.soundNewMR}
          onChange={(v) => update("soundNewMR", v)}
        />
        <Toggle
          label="Notify when assigned as reviewer"
          checked={preferences.notifyAssigned}
          onChange={(v) => update("notifyAssigned", v)}
        />
        <Toggle
          label="Notify when ready to merge"
          checked={preferences.notifyReadyToMerge}
          onChange={(v) => update("notifyReadyToMerge", v)}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>JIRA Integration</h3>
        <p className={styles.sectionDesc}>
          Set your JIRA base URL to make ticket references clickable (e.g. https://myteam.atlassian.net).
        </p>
        <input
          type="url"
          placeholder="https://myteam.atlassian.net"
          value={preferences.jiraBaseUrl}
          onChange={(e) => update("jiraBaseUrl", e.target.value)}
          className={styles.textInput}
        />
      </section>
    </Modal>
  );
}
