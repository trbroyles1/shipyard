// @vitest-environment jsdom
import "@/test/setup-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@/test/component-wrapper";
import { MRCard } from "../MRCard";
import {
  MOCK_MR_AUTHORED,
  MOCK_MR_DRAFT,
  MOCK_MR_MERGEABLE,
  MOCK_MR_TO_REVIEW,
} from "@/test/fixtures/mr-summary.fixture";

vi.mock("next-auth/react", () => import("@/test/mocks/next-auth-react"));
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: Record<string, unknown>) =>
    // eslint-disable-next-line @next/next/no-img-element -- test stub replacing next/image
    <img src={src as string} alt={alt as string} width={width as number} height={height as number} />,
}));

const wrapper = createWrapper();

describe("MRCard", () => {
  it("renders repo and title text", () => {
    render(<MRCard mr={MOCK_MR_AUTHORED} />, { wrapper });

    expect(screen.getByText(MOCK_MR_AUTHORED.repo)).toBeInTheDocument();
    expect(screen.getByText(MOCK_MR_AUTHORED.title)).toBeInTheDocument();
  });

  it("shows Draft badge when mr.draft is true", () => {
    render(<MRCard mr={MOCK_MR_DRAFT} />, { wrapper });
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("does not show Draft badge for non-draft MR", () => {
    render(<MRCard mr={MOCK_MR_AUTHORED} />, { wrapper });
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
  });

  it("shows Ready to merge badge when detailedMergeStatus is mergeable and not draft", () => {
    render(<MRCard mr={MOCK_MR_MERGEABLE} />, { wrapper });
    expect(screen.getByText("Ready to merge")).toBeInTheDocument();
  });

  it("does not show Ready to merge badge for draft MR even if mergeable status", () => {
    const draftMergeable = { ...MOCK_MR_DRAFT, detailedMergeStatus: "mergeable" as const };
    render(<MRCard mr={draftMergeable} />, { wrapper });
    expect(screen.queryByText("Ready to merge")).not.toBeInTheDocument();
  });

  it("shows approval display as given/required", () => {
    render(<MRCard mr={MOCK_MR_AUTHORED} />, { wrapper });
    expect(screen.getByText(`${MOCK_MR_AUTHORED.approvalsGiven}/${MOCK_MR_AUTHORED.approvalsRequired}`)).toBeInTheDocument();
  });

  it("shows green approval dot when given >= required > 0", () => {
    render(<MRCard mr={MOCK_MR_MERGEABLE} />, { wrapper });
    const approvalText = screen.getByText(`${MOCK_MR_MERGEABLE.approvalsGiven}/${MOCK_MR_MERGEABLE.approvalsRequired}`);
    const dot = approvalText.parentElement!.querySelector(".approvalDot");
    expect(dot).toHaveStyle({ background: "var(--grn)" });
  });

  it("shows red approval dot when given < required", () => {
    render(<MRCard mr={MOCK_MR_TO_REVIEW} />, { wrapper });
    const approvalText = screen.getByText(`${MOCK_MR_TO_REVIEW.approvalsGiven}/${MOCK_MR_TO_REVIEW.approvalsRequired}`);
    const dot = approvalText.parentElement!.querySelector(".approvalDot");
    expect(dot).toHaveStyle({ background: "var(--red)" });
  });

  it("renders StatusDot when pipeline is non-null", () => {
    render(<MRCard mr={MOCK_MR_AUTHORED} />, { wrapper });
    const meta = document.querySelector(".meta")!;
    const dots = meta.querySelectorAll(".dot");
    expect(dots.length).toBeGreaterThan(0);
  });

  it("does not render StatusDot when pipeline is null", () => {
    render(<MRCard mr={MOCK_MR_DRAFT} />, { wrapper });
    const meta = document.querySelector(".meta")!;
    const dots = meta.querySelectorAll(".dot");
    expect(dots.length).toBe(0);
  });

  it("selects MR on click", async () => {
    const user = userEvent.setup();

    function TestHarness() {
      return (
        <>
          <MRCard mr={MOCK_MR_AUTHORED} />
          <MRCard mr={MOCK_MR_TO_REVIEW} />
        </>
      );
    }

    render(<TestHarness />, { wrapper });

    const buttons = screen.getAllByRole("button");
    const firstCard = buttons[0];

    expect(firstCard).not.toHaveClass("selected");

    await user.click(firstCard);

    expect(firstCard).toHaveClass("selected");
  });
});
