"use client";

import { type ReactNode, Children, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { JIRA_TICKET_RE, normalizeJiraBaseUrl, jiraTicketUrl } from "@/lib/jira-utils";
import { MermaidBlock } from "./MermaidBlock";
import styles from "./MarkdownBody.module.css";

interface Props {
  content: string;
  jiraBaseUrl?: string;
  className?: string;
  compact?: boolean;
}

function processJiraInString(text: string, baseUrl: string | undefined): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const normalized = normalizeJiraBaseUrl(baseUrl);

  JIRA_TICKET_RE.lastIndex = 0;
  while ((match = JIRA_TICKET_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const ticket = match[1];
    if (normalized) {
      parts.push(
        <a
          key={`jira-${match.index}`}
          className={styles.jiraLink}
          href={jiraTicketUrl(normalized, ticket)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {ticket}
        </a>,
      );
    } else {
      parts.push(
        <span key={`jira-${match.index}`} className={styles.jiraLink}>
          {ticket}
        </span>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts.length > 0 ? parts : [text];
}

function processJiraInChildren(children: ReactNode, baseUrl: string | undefined): ReactNode {
  if (!baseUrl) return children;
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      const processed = processJiraInString(child, baseUrl);
      return processed.length === 1 && typeof processed[0] === "string" ? child : <>{processed}</>;
    }
    return child;
  });
}

const MERMAID_LANG = "language-mermaid";

function buildComponentMap(jiraBaseUrl: string | undefined) {
  return {
    h1: ({ children }: ComponentPropsWithoutRef<"h1">) => (
      <h1 className={styles.h1}>{children}</h1>
    ),
    h2: ({ children }: ComponentPropsWithoutRef<"h2">) => (
      <h2 className={styles.h2}>{children}</h2>
    ),
    h3: ({ children }: ComponentPropsWithoutRef<"h3">) => (
      <h3 className={styles.h3}>{children}</h3>
    ),
    h4: ({ children }: ComponentPropsWithoutRef<"h4">) => (
      <h4 className={styles.h4}>{children}</h4>
    ),
    h5: ({ children }: ComponentPropsWithoutRef<"h5">) => (
      <h5 className={styles.h5}>{children}</h5>
    ),
    h6: ({ children }: ComponentPropsWithoutRef<"h6">) => (
      <h6 className={styles.h6}>{children}</h6>
    ),
    p: ({ children }: ComponentPropsWithoutRef<"p">) => (
      <p className={styles.p}>{processJiraInChildren(children, jiraBaseUrl)}</p>
    ),
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
    blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote className={styles.blockquote}>
        {processJiraInChildren(children, jiraBaseUrl)}
      </blockquote>
    ),
    table: ({ children }: ComponentPropsWithoutRef<"table">) => (
      <table className={styles.table}>{children}</table>
    ),
    th: ({ children }: ComponentPropsWithoutRef<"th">) => (
      <th className={styles.th}>{processJiraInChildren(children, jiraBaseUrl)}</th>
    ),
    td: ({ children }: ComponentPropsWithoutRef<"td">) => (
      <td className={styles.td}>{processJiraInChildren(children, jiraBaseUrl)}</td>
    ),
    ul: ({ children }: ComponentPropsWithoutRef<"ul">) => (
      <ul className={styles.ul}>{children}</ul>
    ),
    ol: ({ children }: ComponentPropsWithoutRef<"ol">) => (
      <ol className={styles.ol}>{children}</ol>
    ),
    li: ({ children }: ComponentPropsWithoutRef<"li">) => (
      <li className={styles.li}>{processJiraInChildren(children, jiraBaseUrl)}</li>
    ),
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

  const components = buildComponentMap(jiraBaseUrl);

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
