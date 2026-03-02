"use client";

import styles from "./error.module.css";

const HEADING = "Something went wrong";
const RETRY_LABEL = "Try again";
const SIGN_IN_LABEL = "Sign in again";
const SIGN_IN_HREF = "/auth/signin";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{HEADING}</h1>
      <p className={styles.message}>{error.message || "An unexpected error occurred."}</p>
      <div className={styles.actions}>
        <button className={styles.retryBtn} onClick={reset}>
          {RETRY_LABEL}
        </button>
        <a className={styles.signInLink} href={SIGN_IN_HREF}>
          {SIGN_IN_LABEL}
        </a>
      </div>
    </div>
  );
}
