"use client";

import { useState, useEffect } from "react";
import type { GitLabPipeline, GitLabMergeRequest, GitLabJob } from "@/lib/types/gitlab";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { JobLogModal } from "./JobLogModal";
import styles from "./PipelineTab.module.css";

interface Props {
  pipelines: GitLabPipeline[];
  mr: GitLabMergeRequest;
}

const STATUS_ICON: Record<string, { color: string; symbol: string }> = {
  success: { color: "var(--grn)", symbol: "\u2713" },
  failed: { color: "var(--red)", symbol: "\u2717" },
  running: { color: "var(--acc)", symbol: "\u25b6" },
  pending: { color: "var(--yel)", symbol: "\u25cf" },
  canceled: { color: "var(--tm)", symbol: "\u25cb" },
  skipped: { color: "var(--tm)", symbol: "\u2192" },
  manual: { color: "var(--org)", symbol: "\u25a0" },
  created: { color: "var(--t2)", symbol: "\u25cf" },
};

interface LogTarget {
  jobId: number;
  jobName: string;
  pipelineId: number;
}

export function PipelineTab({ pipelines, mr }: Props) {
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);

  if (pipelines.length === 0) {
    return <div className={styles.empty}>No pipelines found.</div>;
  }

  return (
    <div className={styles.list}>
      {pipelines.map((pipeline) => (
        <PipelineRow
          key={pipeline.id}
          pipeline={pipeline}
          projectId={mr.project_id}
          onViewLog={(jobId, jobName) =>
            setLogTarget({ jobId, jobName, pipelineId: pipeline.id })
          }
        />
      ))}
      {logTarget && (
        <JobLogModal
          jobName={logTarget.jobName}
          projectId={mr.project_id}
          pipelineId={logTarget.pipelineId}
          jobId={logTarget.jobId}
          onClose={() => setLogTarget(null)}
        />
      )}
    </div>
  );
}

function PipelineRow({ pipeline, projectId, onViewLog }: { pipeline: GitLabPipeline; projectId: number; onViewLog: (jobId: number, jobName: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [jobs, setJobs] = useState<GitLabJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const statusInfo = STATUS_ICON[pipeline.status] || STATUS_ICON.created;

  useEffect(() => {
    if (!expanded || jobs.length > 0) return;
    setLoadingJobs(true);
    fetch(`/api/gitlab/merge-requests/${projectId}/0/pipelines/${pipeline.id}/jobs`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: GitLabJob[]) => setJobs(data))
      .catch(() => setJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [expanded, jobs.length, projectId, pipeline.id]);

  return (
    <div className={styles.pipeline}>
      <div className={styles.pipelineHeader} onClick={() => setExpanded(!expanded)}>
        <span className={styles.status} style={{ color: statusInfo.color }}>
          {statusInfo.symbol}
        </span>
        <span className={styles.pipelineId}>#{pipeline.id}</span>
        <span className={styles.pipelineStatus} style={{ color: statusInfo.color }}>
          {pipeline.status}
        </span>
        <span className={styles.pipelineRef}>{pipeline.ref}</span>
        <span className={styles.pipelineTime}>
          <RelativeTime date={pipeline.created_at} />
        </span>
        <a
          href={pipeline.web_url}
          target="_blank"
          rel="noreferrer"
          className={styles.pipelineLink}
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {expanded && (
        <div className={styles.jobs}>
          {loadingJobs && <div className={styles.jobLoading}>Loading jobs...</div>}
          {!loadingJobs && jobs.length === 0 && <div className={styles.jobLoading}>No jobs found.</div>}
          {jobs.map((job) => {
            const jobStatus = STATUS_ICON[job.status] || STATUS_ICON.created;
            return (
              <div key={job.id} className={styles.job}>
                <span className={styles.jobStatus} style={{ color: jobStatus.color }}>
                  {jobStatus.symbol}
                </span>
                <span className={styles.jobStage}>{job.stage}</span>
                <span className={styles.jobName}>{job.name}</span>
                {job.duration != null && (
                  <span className={styles.jobDuration}>{formatDuration(job.duration)}</span>
                )}
                <button
                  className={styles.jobLogBtn}
                  onClick={() => onViewLog(job.id, job.name)}
                  title="View job log"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                </button>
                <a
                  href={job.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.jobLink}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
