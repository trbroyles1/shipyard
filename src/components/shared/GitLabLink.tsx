import styles from "./GitLabLink.module.css";

interface GitLabLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function GitLabLink({ href, children, className }: GitLabLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${styles.link} ${className || ""}`}
    >
      {children}
    </a>
  );
}
