// @vitest-environment jsdom
import "@/test/setup-dom";
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { FilterSortProvider, useFilterSort } from "../FilterSortProvider";

describe("FilterSortProvider", () => {
  it("provides default state", () => {
    const { result } = renderHook(() => useFilterSort(), { wrapper: FilterSortProvider });

    expect(result.current.filter).toBe("all");
    expect(result.current.sortField).toBe("age");
    expect(result.current.sortDirection).toBe("asc");
  });

  it("updates filter via setFilter", () => {
    const { result } = renderHook(() => useFilterSort(), { wrapper: FilterSortProvider });

    act(() => result.current.setFilter("mine"));
    expect(result.current.filter).toBe("mine");

    act(() => result.current.setFilter("to-review"));
    expect(result.current.filter).toBe("to-review");
  });

  it("cycles toggleSort through age-asc -> age-desc -> repo-asc -> repo-desc -> age-asc", () => {
    const { result } = renderHook(() => useFilterSort(), { wrapper: FilterSortProvider });

    expect(result.current.sortField).toBe("age");
    expect(result.current.sortDirection).toBe("asc");

    act(() => result.current.toggleSort());
    expect(result.current.sortField).toBe("age");
    expect(result.current.sortDirection).toBe("desc");

    act(() => result.current.toggleSort());
    expect(result.current.sortField).toBe("repo");
    expect(result.current.sortDirection).toBe("asc");

    act(() => result.current.toggleSort());
    expect(result.current.sortField).toBe("repo");
    expect(result.current.sortDirection).toBe("desc");

    act(() => result.current.toggleSort());
    expect(result.current.sortField).toBe("age");
    expect(result.current.sortDirection).toBe("asc");
  });

  it("throws when useFilterSort is used outside provider", () => {
    expect(() => {
      renderHook(() => useFilterSort());
    }).toThrow("useFilterSort must be used within FilterSortProvider");
  });
});
