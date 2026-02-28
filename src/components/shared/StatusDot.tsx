import styles from "./StatusDot.module.css";

interface StatusDotProps {
  status: string;
  size?: number;
  pulse?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  success: "var(--grn)",
  running: "var(--yel)",
  failed: "var(--red)",
  pending: "var(--tm)",
  canceled: "var(--tm)",
  skipped: "var(--tm)",
  created: "var(--tm)",
  manual: "var(--org)",
};

export function StatusDot({ status, size = 8, pulse }: StatusDotProps) {
  const color = STATUS_COLORS[status] || "var(--tm)";
  const shouldPulse = pulse ?? status === "running";

  return (
    <span
      className={`${styles.dot} ${shouldPulse ? styles.pulse : ""}`}
      style={{ width: size, height: size, background: color }}
    />
  );
}
