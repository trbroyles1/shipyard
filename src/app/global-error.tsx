"use client";

import { SIGN_IN_PATH } from "@/lib/constants";
import styles from "./global-error.module.css";

const HEADING = "Something went wrong";
const RETRY_LABEL = "Try again";
const SIGN_IN_LABEL = "Sign in again";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className={styles.container}>
          <h1 className={styles.heading}>{HEADING}</h1>
          <p className={styles.message}>{error.message || "An unexpected error occurred."}</p>
          <div className={styles.actions}>
            <button className={styles.retryBtn} onClick={reset}>
              {RETRY_LABEL}
            </button>
            <a className={styles.signInLink} href={SIGN_IN_PATH}>
              {SIGN_IN_LABEL}
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
