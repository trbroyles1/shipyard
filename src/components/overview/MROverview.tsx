"use client";

import { useState } from "react";
import type { MRDetailData } from "@/hooks/use-mr-detail";
import type { MRSummary } from "@/lib/types/mr";
import { BranchIndicator } from "./BranchIndicator";
import { LabelPills } from "./LabelPills";
import { StatsRow } from "./StatsRow";
import { ActionButtons } from "./ActionButtons";
import { DescriptionBody } from "./DescriptionBody";
import styles from "./MROverview.module.css";

interface Props {
  summary: MRSummary;
  detail: MRDetailData;
}

export function MROverview({ summary, detail }: Props) {
  const [expanded, setExpanded] = useState(true);
  const mr = detail.mr;
  const approvals = detail.approvals;

  return (
    <div className={`${styles.overview} ${expanded ? styles.expanded : styles.collapsed}`}>
      <div
        className={`${styles.toggle} ${expanded ? styles.toggleExpanded : ""}`}
        onClick={() => setExpanded(!expanded)}
      >
        <h2 className={styles.heading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="18" r="3"/>
            <circle cx="6" cy="6" r="3"/>
            <path d="M6 21V9a9 9 0 0 0 9 9"/>
          </svg>
          !{mr.iid} &middot; {summary.repo}
        </h2>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={styles.chevron}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {expanded && (
        <div className={styles.body}>
          <div className={styles.title}>{mr.title}</div>
          <BranchIndicator source={mr.source_branch} target={mr.target_branch} />
          {mr.description && (
            <div className={styles.description}>
              <DescriptionBody text={mr.description} />
            </div>
          )}
          <LabelPills labels={mr.labels} draft={mr.draft} conflicts={mr.has_conflicts} />
          <StatsRow
            pipelineStatus={mr.head_pipeline?.status || null}
            approvalsGiven={approvals.approved_by.length}
            approvalsRequired={approvals.approvals_required}
            changesCount={parseInt(mr.changes_count || "0", 10) || 0}
            authorUsername={mr.author.username}
            authorUrl={mr.author.web_url}
          />
          <ActionButtons
            mergeable={mr.detailed_merge_status === "mergeable" && !mr.draft}
            mergeStatus={mr.detailed_merge_status}
            webUrl={mr.web_url}
          />
        </div>
      )}
    </div>
  );
}
