// @vitest-environment jsdom
import "@/test/setup-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@/test/component-wrapper";
import { DiscussionThread } from "../DiscussionThread";
import {
  MOCK_DISCUSSION,
  MOCK_DISCUSSION_RESOLVED,
  MOCK_NOTE,
  MOCK_SYSTEM_NOTE,
} from "@/lib/__tests__/fixtures/gitlab-discussions.fixture";
import { MOCK_USER, MOCK_REVIEWER } from "@/lib/__tests__/fixtures/gitlab-mr.fixture";
import type { GitLabDiscussion, GitLabNote } from "@/lib/types/gitlab";

vi.mock("@/components/shared/MarkdownBody", () => import("@/test/mocks/markdown-body"));
vi.mock("next-auth/react", () => import("@/test/mocks/next-auth-react"));
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: Record<string, unknown>) =>
    // eslint-disable-next-line @next/next/no-img-element -- test stub replacing next/image
    <img src={src as string} alt={alt as string} width={width as number} height={height as number} />,
}));

const wrapper = createWrapper();

const SECOND_NOTE: GitLabNote = {
  ...MOCK_NOTE,
  id: 510,
  body: "Good point, I will refactor.",
  author: MOCK_REVIEWER,
  created_at: "2025-01-15T13:00:00Z",
  updated_at: "2025-01-15T13:00:00Z",
};

const THIRD_NOTE: GitLabNote = {
  ...MOCK_NOTE,
  id: 511,
  body: "Resolved this.",
  author: MOCK_USER,
  created_at: "2025-01-15T14:00:00Z",
  updated_at: "2025-01-15T14:00:00Z",
};

const MULTI_NOTE_DISCUSSION: GitLabDiscussion = {
  id: "multi-note-disc-id",
  individual_note: false,
  notes: [MOCK_NOTE, SECOND_NOTE, MOCK_SYSTEM_NOTE, THIRD_NOTE],
};

describe("DiscussionThread", () => {
  it("shows first note author name and body preview when collapsed", () => {
    render(<DiscussionThread discussion={MOCK_DISCUSSION} />, { wrapper });
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(MOCK_NOTE.body)).toBeInTheDocument();
  });

  it("shows Resolved badge for resolved discussion", () => {
    render(<DiscussionThread discussion={MOCK_DISCUSSION_RESOLVED} />, { wrapper });
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("shows reply count excluding system notes", () => {
    render(<DiscussionThread discussion={MULTI_NOTE_DISCUSSION} />, { wrapper });
    // 4 notes total, 1 system -> 3 non-system. First is header, so 2 replies.
    expect(screen.getByText("2 replies")).toBeInTheDocument();
  });

  it("expands on header click and shows all non-system notes", async () => {
    const user = userEvent.setup();
    render(<DiscussionThread discussion={MULTI_NOTE_DISCUSSION} />, { wrapper });

    const header = document.querySelector(".header")!;
    await user.click(header);

    const markdownBodies = screen.getAllByTestId("markdown-body");
    expect(markdownBodies).toHaveLength(3);
    expect(markdownBodies[0]).toHaveTextContent(MOCK_NOTE.body);
    expect(markdownBodies[1]).toHaveTextContent(SECOND_NOTE.body);
    expect(markdownBodies[2]).toHaveTextContent(THIRD_NOTE.body);
  });

  it("filters out system notes from expanded view", async () => {
    const user = userEvent.setup();
    render(<DiscussionThread discussion={MULTI_NOTE_DISCUSSION} />, { wrapper });

    const header = document.querySelector(".header")!;
    await user.click(header);

    const markdownBodies = screen.getAllByTestId("markdown-body");
    const texts = markdownBodies.map((el) => el.textContent);
    expect(texts).not.toContain(MOCK_SYSTEM_NOTE.body);
  });

  it("shows reply textarea when onReply is provided and expanded", () => {
    const onReply = vi.fn().mockResolvedValue(undefined);

    render(
      <DiscussionThread discussion={MOCK_DISCUSSION} defaultExpanded onReply={onReply} />,
      { wrapper },
    );

    expect(screen.getByPlaceholderText(/reply/i)).toBeInTheDocument();
  });

  it("disables reply button when textarea is empty", () => {
    const onReply = vi.fn().mockResolvedValue(undefined);
    render(
      <DiscussionThread discussion={MOCK_DISCUSSION} defaultExpanded onReply={onReply} />,
      { wrapper },
    );

    expect(screen.getByText("Reply")).toBeDisabled();
  });

  it("calls onReply with discussion id and body on submit", async () => {
    const user = userEvent.setup();
    const onReply = vi.fn().mockResolvedValue(undefined);

    render(
      <DiscussionThread discussion={MOCK_DISCUSSION} defaultExpanded onReply={onReply} />,
      { wrapper },
    );

    const textarea = screen.getByPlaceholderText(/reply/i);
    await user.type(textarea, "LGTM!");
    await user.click(screen.getByText("Reply"));

    expect(onReply).toHaveBeenCalledWith(MOCK_DISCUSSION.id, "LGTM!");
  });

  it("clears textarea after successful reply", async () => {
    const user = userEvent.setup();
    const onReply = vi.fn().mockResolvedValue(undefined);

    render(
      <DiscussionThread discussion={MOCK_DISCUSSION} defaultExpanded onReply={onReply} />,
      { wrapper },
    );

    const textarea = screen.getByPlaceholderText(/reply/i) as HTMLTextAreaElement;
    await user.type(textarea, "LGTM!");
    await user.click(screen.getByText("Reply"));

    expect(textarea.value).toBe("");
  });

  it("submits reply on Ctrl+Enter", async () => {
    const user = userEvent.setup();
    const onReply = vi.fn().mockResolvedValue(undefined);

    render(
      <DiscussionThread discussion={MOCK_DISCUSSION} defaultExpanded onReply={onReply} />,
      { wrapper },
    );

    const textarea = screen.getByPlaceholderText(/reply/i);
    await user.type(textarea, "LGTM!");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(onReply).toHaveBeenCalledWith(MOCK_DISCUSSION.id, "LGTM!");
  });

  it("shows resolve button when expanded with onResolve and resolvable note", () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <DiscussionThread discussion={MOCK_DISCUSSION} defaultExpanded onResolve={onResolve} />,
      { wrapper },
    );

    expect(screen.getByText("Resolve")).toBeInTheDocument();
  });

  it("calls onResolve with discussion id and true when clicking Resolve", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <DiscussionThread discussion={MOCK_DISCUSSION} defaultExpanded onResolve={onResolve} />,
      { wrapper },
    );

    await user.click(screen.getByText("Resolve"));
    expect(onResolve).toHaveBeenCalledWith(MOCK_DISCUSSION.id, true);
  });

  it("shows file link button when fileLink prop is provided", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <DiscussionThread
        discussion={MOCK_DISCUSSION}
        fileLink={{ label: "src/utils.ts", onClick }}
      />,
      { wrapper },
    );

    const fileButton = screen.getByText("src/utils.ts");
    expect(fileButton).toBeInTheDocument();

    await user.click(fileButton);
    expect(onClick).toHaveBeenCalled();
  });
});
