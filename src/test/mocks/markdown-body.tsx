interface Props {
  content: string;
  jiraBaseUrl?: string;
  compact?: boolean;
}

export function MarkdownBody({ content }: Props) {
  return <div data-testid="markdown-body">{content}</div>;
}
