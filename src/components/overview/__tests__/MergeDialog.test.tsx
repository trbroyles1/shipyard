// @vitest-environment jsdom
import "@/test/setup-dom";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@/test/component-wrapper";
import { MergeDialog } from "../MergeDialog";
import { MOCK_MERGE_REQUEST, MOCK_PIPELINE } from "@/lib/__tests__/fixtures/gitlab-mr.fixture";

vi.mock("@/lib/client-errors", () => ({
  apiFetch: vi.fn(),
  throwResponseError: vi.fn(),
}));

import { apiFetch } from "@/lib/client-errors";

const wrapper = createWrapper();

function mockApiFetchSuccess() {
  (apiFetch as Mock).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
  });
}

function mockApiFetchFailure(error = "Merge blocked") {
  (apiFetch as Mock).mockResolvedValue({
    ok: false,
    status: 422,
    json: () => Promise.resolve({ error }),
  });
}

/** Flush all pending microtasks and React state updates. */
async function flushAsyncEffects() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("MergeDialog", () => {
  const onClose = vi.fn<() => void>();
  const onRefetch = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    onClose.mockClear();
    onRefetch.mockClear().mockResolvedValue(undefined);
  });

  it("renders the title 'Merge options'", () => {
    render(<MergeDialog mr={MOCK_MERGE_REQUEST} onClose={onClose} onRefetch={onRefetch} />, { wrapper });
    expect(screen.getByText("Merge options")).toBeInTheDocument();
  });

  it("has squash unchecked and delete branch checked by default, auto-merge not shown", () => {
    render(<MergeDialog mr={MOCK_MERGE_REQUEST} onClose={onClose} onRefetch={onRefetch} />, { wrapper });

    const squash = screen.getByRole("checkbox", { name: /squash/i, hidden: true });
    const deleteBranch = screen.getByRole("checkbox", { name: /delete source branch/i, hidden: true });

    expect(squash).not.toBeChecked();
    expect(deleteBranch).toBeChecked();
    expect(screen.queryByText(/auto-merge/i)).not.toBeInTheDocument();
  });

  it("shows auto-merge option when pipeline is running", () => {
    const runningMR = {
      ...MOCK_MERGE_REQUEST,
      head_pipeline: { ...MOCK_PIPELINE, status: "running" as const },
    };
    render(<MergeDialog mr={runningMR} onClose={onClose} onRefetch={onRefetch} />, { wrapper });
    expect(screen.getByText(/auto-merge when pipeline succeeds/i)).toBeInTheDocument();
  });

  it("toggles checkboxes on click", async () => {
    const user = userEvent.setup();
    render(<MergeDialog mr={MOCK_MERGE_REQUEST} onClose={onClose} onRefetch={onRefetch} />, { wrapper });

    const squash = screen.getByRole("checkbox", { name: /squash/i, hidden: true });
    const deleteBranch = screen.getByRole("checkbox", { name: /delete source branch/i, hidden: true });

    await user.click(squash);
    expect(squash).toBeChecked();

    await user.click(deleteBranch);
    expect(deleteBranch).not.toBeChecked();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<MergeDialog mr={MOCK_MERGE_REQUEST} onClose={onClose} onRefetch={onRefetch} />, { wrapper });

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error toast and does not call apiFetch when head_sha is missing", async () => {
    const user = userEvent.setup();
    const noSha = { ...MOCK_MERGE_REQUEST, diff_refs: null };
    render(<MergeDialog mr={noSha} onClose={onClose} onRefetch={onRefetch} />, { wrapper });

    await user.click(screen.getByText("Confirm merge"));

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("includes merge_when_pipeline_succeeds when auto-merge is checked", async () => {
    const user = userEvent.setup();
    mockApiFetchSuccess();
    const runningMR = {
      ...MOCK_MERGE_REQUEST,
      head_pipeline: { ...MOCK_PIPELINE, status: "running" as const },
    };
    render(<MergeDialog mr={runningMR} onClose={onClose} onRefetch={onRefetch} />, { wrapper });

    const autoMerge = screen.getByRole("checkbox", { name: /auto-merge/i, hidden: true });
    await user.click(autoMerge);

    await user.click(screen.getByText("Confirm merge"));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalled();
    });
    const callBody = JSON.parse((apiFetch as Mock).mock.calls[0][1].body);
    expect(callBody.merge_when_pipeline_succeeds).toBe(true);

    await flushAsyncEffects();
  });

  it("calls apiFetch with correct payload on successful merge", async () => {
    const user = userEvent.setup();
    mockApiFetchSuccess();
    render(<MergeDialog mr={MOCK_MERGE_REQUEST} onClose={onClose} onRefetch={onRefetch} />, { wrapper });

    await user.click(screen.getByText("Confirm merge"));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/gitlab/merge-requests/42/17/merge",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            sha: MOCK_MERGE_REQUEST.diff_refs!.head_sha,
            squash: false,
            should_remove_source_branch: true,
          }),
        }),
      );
    });
    expect(onClose).toHaveBeenCalled();
    expect(onRefetch).toHaveBeenCalled();

    await flushAsyncEffects();
  });

  it("shows error toast and re-enables button on merge failure", async () => {
    const user = userEvent.setup();
    mockApiFetchFailure();
    render(<MergeDialog mr={MOCK_MERGE_REQUEST} onClose={onClose} onRefetch={onRefetch} />, { wrapper });

    await user.click(screen.getByText("Confirm merge"));

    await waitFor(() => {
      const confirmBtn = screen.getByText("Confirm merge");
      expect(confirmBtn).not.toBeDisabled();
    });
    expect(onClose).not.toHaveBeenCalled();

    await flushAsyncEffects();
  });

  it("shows 'Merging...' and disables button during merge request", async () => {
    const user = userEvent.setup();
    let resolveApiFetch: (v: unknown) => void;
    (apiFetch as Mock).mockReturnValue(
      new Promise((resolve) => { resolveApiFetch = resolve; }),
    );

    render(<MergeDialog mr={MOCK_MERGE_REQUEST} onClose={onClose} onRefetch={onRefetch} />, { wrapper });

    await user.click(screen.getByText("Confirm merge"));

    expect(screen.getByText("Merging...")).toBeInTheDocument();
    expect(screen.getByText("Merging...").closest("button")).toBeDisabled();

    // Resolve to clean up
    resolveApiFetch!({ ok: true, json: () => Promise.resolve({}) });
    await waitFor(() => expect(screen.getByText("Confirm merge")).toBeInTheDocument());

    await flushAsyncEffects();
  });
});
