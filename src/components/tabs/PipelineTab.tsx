"use client";

import { useState, useEffect } from "react";
import type { GitLabPipeline, GitLabMergeRequest, GitLabJob } from "@/lib/types/gitlab";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { ExternalLinkIcon, ChevronIcon, TerminalIcon } from "@/components/shared/icons";
import { apiFetch } from "@/lib/client-errors";
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
  jobStatus: string;
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
          onViewLog={(jobId, jobName, status) =>
            setLogTarget({ jobId, jobName, jobStatus: status })
          }
        />
      ))}
      {logTarget && (
        <JobLogModal
          jobName={logTarget.jobName}
          projectId={mr.project_id}
          jobId={logTarget.jobId}
          jobStatus={logTarget.jobStatus}
          onClose={() => setLogTarget(null)}
        />
      )}
    </div>
  );
}

function PipelineRow({ pipeline, projectId, onViewLog }: { pipeline: GitLabPipeline; projectId: number; onViewLog: (jobId: number, jobName: string, status: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [jobs, setJobs] = useState<GitLabJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Clear cached jobs when pipeline status changes so the fetch effect re-runs
  useEffect(() => {
    setJobs([]);
  }, [pipeline.status]);

  const statusInfo = STATUS_ICON[pipeline.status] || STATUS_ICON.created;

  useEffect(() => {
    if (!expanded || jobs.length > 0) return;
    setLoadingJobs(true);
    apiFetch(`/api/gitlab/projects/${projectId}/pipelines/${pipeline.id}/jobs`)
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
          <ExternalLinkIcon size={12} />
        </a>
        <ChevronIcon
          size={12}
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
        />
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
                  onClick={() => onViewLog(job.id, job.name, job.status)}
                  title="View job log"
                >
                  <TerminalIcon size={12} />
                </button>
                <a
                  href={job.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.jobLink}
                >
                  <ExternalLinkIcon size={10} />
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
