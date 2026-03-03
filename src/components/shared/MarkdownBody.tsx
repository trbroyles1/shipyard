"use client";

import { useMemo, type ReactNode, Children, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { linkifyJiraTickets } from "@/lib/jira-utils";
import { MermaidBlock } from "./MermaidBlock";
import styles from "./MarkdownBody.module.css";

interface Props {
  content: string;
  jiraBaseUrl?: string;
  className?: string;
  compact?: boolean;
}

function processJiraInChildren(children: ReactNode, baseUrl: string | undefined): ReactNode {
  if (!baseUrl) return children;
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      const processed = linkifyJiraTickets(child, baseUrl, styles.jiraLink);
      return processed.length === 1 && typeof processed[0] === "string" ? child : <>{processed}</>;
    }
    return child;
  });
}

const MERMAID_LANG = "language-mermaid";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/** Factory for heading overrides that apply the corresponding CSS module class. */
function headingOverride(tag: HeadingTag) {
  const Tag = tag;
  return ({ children }: ComponentPropsWithoutRef<typeof Tag>) => (
    <Tag className={styles[tag]}>{children}</Tag>
  );
}

/** Wraps a simple tag component so its children are processed for JIRA tickets. */
function withJira(
  tag: keyof JSX.IntrinsicElements,
  styleClass: string,
  jiraBaseUrl: string | undefined,
) {
  const Tag = tag;
  return ({ children }: { children?: ReactNode }) => (
    <Tag className={styleClass}>{processJiraInChildren(children, jiraBaseUrl)}</Tag>
  );
}

function buildComponentMap(jiraBaseUrl: string | undefined) {
  return {
    h1: headingOverride("h1"),
    h2: headingOverride("h2"),
    h3: headingOverride("h3"),
    h4: headingOverride("h4"),
    h5: headingOverride("h5"),
    h6: headingOverride("h6"),
    p: withJira("p", styles.p, jiraBaseUrl),
    a: ({ href, children }: ComponentPropsWithoutRef<"a">) => (
      <a
        className={styles.link}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
      <pre className={styles.codeBlock}>{children}</pre>
    ),
    code: ({ className, children, ...rest }: ComponentPropsWithoutRef<"code"> & { className?: string }) => {
      const isBlock = className?.startsWith("language-");
      if (className === MERMAID_LANG) {
        const code = String(children).replace(/\n$/, "");
        return <MermaidBlock code={code} />;
      }
      if (isBlock) {
        return <code className={className} {...rest}>{children}</code>;
      }
      return <code className={styles.inlineCode} {...rest}>{children}</code>;
    },
    blockquote: withJira("blockquote", styles.blockquote, jiraBaseUrl),
    table: ({ children }: ComponentPropsWithoutRef<"table">) => (
      <table className={styles.table}>{children}</table>
    ),
    th: withJira("th", styles.th, jiraBaseUrl),
    td: withJira("td", styles.td, jiraBaseUrl),
    ul: ({ children }: ComponentPropsWithoutRef<"ul">) => (
      <ul className={styles.ul}>{children}</ul>
    ),
    ol: ({ children }: ComponentPropsWithoutRef<"ol">) => (
      <ol className={styles.ol}>{children}</ol>
    ),
    li: withJira("li", styles.li, jiraBaseUrl),
    hr: () => <hr className={styles.hr} />,
    img: ({ src, alt }: ComponentPropsWithoutRef<"img">) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={styles.img} src={src} alt={alt || ""} />
    ),
  };
}

export function MarkdownBody({ content, jiraBaseUrl, className, compact = false }: Props) {
  const rootClass = [
    styles.root,
    compact ? styles.compact : "",
    className,
  ].filter(Boolean).join(" ");

  const components = useMemo(() => buildComponentMap(jiraBaseUrl), [jiraBaseUrl]);

  return (
    <div className={rootClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
