// @vitest-environment jsdom
import "@/test/setup-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useRef, useEffect } from "react";
import { createWrapper } from "@/test/component-wrapper";
import { MRList } from "../MRList";
import { useFilterSort, type FilterMode } from "@/components/providers/FilterSortProvider";
import {
  MOCK_MR_AUTHORED,
  MOCK_MR_TO_REVIEW,
  MOCK_MR_DRAFT,
  MOCK_MR_MERGEABLE,
} from "@/test/fixtures/mr-summary.fixture";
import type { MRSummary } from "@/lib/types/mr";

vi.mock("next-auth/react", () => import("@/test/mocks/next-auth-react"));
vi.mock("next/image", () => ({
  default: ({ src, alt, width, height }: Record<string, unknown>) =>
    // eslint-disable-next-line @next/next/no-img-element -- test stub replacing next/image
    <img src={src as string} alt={alt as string} width={width as number} height={height as number} />,
}));

const ALL_MRS = [MOCK_MR_AUTHORED, MOCK_MR_TO_REVIEW, MOCK_MR_DRAFT, MOCK_MR_MERGEABLE];

const wrapper = createWrapper();

/**
 * Helper that renders MRList and applies a filter via useFilterSort
 * inside the same provider tree.
 */
function MRListWithFilter({ mrs, isLoading, filter, sortClicks = 0 }: {
  mrs: MRSummary[];
  isLoading: boolean;
  filter?: FilterMode;
  sortClicks?: number;
}) {
  const { setFilter, toggleSort } = useFilterSort();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (filter) setFilter(filter);
    for (let i = 0; i < sortClicks; i++) toggleSort();
  }, [filter, sortClicks, setFilter, toggleSort]);

  return <MRList mrs={mrs} isLoading={isLoading} />;
}

describe("MRList", () => {
  it("renders 5 skeleton elements when loading", () => {
    render(<MRList mrs={[]} isLoading={true} />, { wrapper });
    const skeletons = document.querySelectorAll(".skeleton");
    expect(skeletons).toHaveLength(5);
  });

  it("shows empty message when no MRs after filtering", () => {
    render(<MRList mrs={[]} isLoading={false} />, { wrapper });
    expect(screen.getByText("No merge requests found")).toBeInTheDocument();
  });

  it("renders one MRCard per MR", () => {
    render(<MRList mrs={ALL_MRS} isLoading={false} />, { wrapper });
    const cards = document.querySelectorAll(".card");
    expect(cards).toHaveLength(4);
  });

  it("filters to 'mine' showing only MRs authored/assigned by user 1", () => {
    render(
      <MRListWithFilter mrs={ALL_MRS} isLoading={false} filter="mine" />,
      { wrapper },
    );

    const cards = document.querySelectorAll(".card");
    expect(cards).toHaveLength(1);
    expect(screen.getByText(MOCK_MR_AUTHORED.title)).toBeInTheDocument();
  });

  it("filters to 'to-review' showing MRs where user 1 is reviewer but not author", () => {
    render(
      <MRListWithFilter mrs={ALL_MRS} isLoading={false} filter="to-review" />,
      { wrapper },
    );

    const cards = document.querySelectorAll(".card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText(MOCK_MR_TO_REVIEW.title)).toBeInTheDocument();
    expect(screen.getByText(MOCK_MR_MERGEABLE.title)).toBeInTheDocument();
  });

  it("sorts by age ascending (oldest first) by default", () => {
    render(<MRList mrs={ALL_MRS} isLoading={false} />, { wrapper });

    const cards = document.querySelectorAll(".card");
    const repos = Array.from(cards).map((c) => c.querySelector(".repo")!.textContent);

    // Oldest: MOCK_MR_MERGEABLE (Jan 13), then MOCK_MR_AUTHORED (Jan 14)
    expect(repos[0]).toBe("infra/ci-tools");
    expect(repos[1]).toBe("frontend/shipyard");
  });

  it("sorts by repo ascending (alphabetical)", () => {
    // toggleSort cycle: age-asc -> age-desc -> repo-asc (2 clicks)
    render(
      <MRListWithFilter mrs={ALL_MRS} isLoading={false} sortClicks={2} />,
      { wrapper },
    );

    const cards = document.querySelectorAll(".card");
    const repos = Array.from(cards).map((c) => c.querySelector(".repo")!.textContent);

    expect(repos[0]).toBe("backend/auth-service");
    expect(repos[1]).toBe("frontend/shipyard");
    expect(repos[2]).toBe("frontend/shipyard");
    expect(repos[3]).toBe("infra/ci-tools");
  });
});
