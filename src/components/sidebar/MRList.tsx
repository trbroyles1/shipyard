"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { useAppState } from "@/components/providers/AppStateProvider";
import { MRCard } from "./MRCard";
import type { MRSummary } from "@/lib/types/mr";
import styles from "./MRList.module.css";

interface MRListProps {
  mrs: MRSummary[];
  isLoading: boolean;
}

export function MRList({ mrs, isLoading }: MRListProps) {
  const { data: session } = useSession();
  const { filter, sortField, sortDirection } = useAppState();

  const currentUserEmail = session?.user?.email;

  const filteredAndSorted = useMemo(() => {
    let filtered = mrs;

    if (filter === "mine") {
      // MRs where the current user is the author (assignee in the plan's terms)
      filtered = mrs.filter((mr) =>
        mr.author.username === currentUserEmail?.split("@")[0] ||
        mr.assignees.some((a) => a.username === currentUserEmail?.split("@")[0])
      );
    } else if (filter === "to-review") {
      // MRs where the current user is a reviewer but not the author
      filtered = mrs.filter((mr) =>
        mr.reviewers.some((r) => r.username === currentUserEmail?.split("@")[0]) &&
        mr.author.username !== currentUserEmail?.split("@")[0]
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp: number;
      if (sortField === "age") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp = a.repo.localeCompare(b.repo);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [mrs, filter, sortField, sortDirection, currentUserEmail]);

  if (isLoading) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeleton}>
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonMeta} />
          </div>
        ))}
      </div>
    );
  }

  if (filteredAndSorted.length === 0) {
    return (
      <div className={styles.list}>
        <div className={styles.empty}>No merge requests found</div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {filteredAndSorted.map((mr) => (
        <MRCard key={mr.id} mr={mr} />
      ))}
    </div>
  );
}
