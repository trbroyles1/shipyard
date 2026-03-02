import styles from "./not-found.module.css";

const HEADING = "Page not found";
const MESSAGE = "The page you're looking for doesn't exist.";
const BACK_LABEL = "Back to dashboard";
const BACK_HREF = "/";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{HEADING}</h1>
      <p className={styles.message}>{MESSAGE}</p>
      <a className={styles.backLink} href={BACK_HREF}>
        {BACK_LABEL}
      </a>
    </div>
  );
}
