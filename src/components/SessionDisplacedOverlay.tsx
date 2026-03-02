"use client";

import styles from "./SessionDisplacedOverlay.module.css";

const HEADING_TEXT = "Session Active Elsewhere";
const BODY_TEXT =
  "Shipyard was opened in another tab or browser. This session has been paused to avoid conflicts.";
const BUTTON_TEXT = "Use This Tab Instead";

function handleReclaim() {
  window.location.reload();
}

export function SessionDisplacedOverlay() {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="5" r="3" />
            <line x1="12" y1="22" x2="12" y2="8" />
            <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
          </svg>
        </div>
        <h2 className={styles.heading}>{HEADING_TEXT}</h2>
        <p className={styles.body}>{BODY_TEXT}</p>
        <button className={styles.button} onClick={handleReclaim}>
          {BUTTON_TEXT}
        </button>
      </div>
    </div>
  );
}
