import styles from "./Avatar.module.css";

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ name, avatarUrl, size = 24 }: AvatarProps) {
  if (avatarUrl) {
    return (
      <img
        className={styles.avatar}
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
      />
    );
  }

  return (
    <span
      className={styles.fallback}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {getInitials(name)}
    </span>
  );
}
