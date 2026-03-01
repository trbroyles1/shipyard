"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnsiUp } from "ansi_up";
import styles from "./JobLogModal.module.css";

interface Props {
  jobName: string;
  projectId: number;
  pipelineId: number;
  jobId: number;
  onClose: () => void;
}

const ansi = new AnsiUp();
ansi.use_classes = false;

export function JobLogModal({ jobName, projectId, pipelineId, jobId, onClose }: Props) {
  const [log, setLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = `/api/gitlab/merge-requests/${projectId}/0/pipelines/${pipelineId}/jobs/${jobId}/trace`;
    setLoading(true);
    setError(null);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => setLog(text))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load log"))
      .finally(() => setLoading(false));
  }, [projectId, pipelineId, jobId]);

  // Scroll to bottom once log loads
  useEffect(() => {
    if (log && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [log]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const htmlContent = log ? ansi.ansi_to_html(log) : "";

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={`${styles.modal} ${maximized ? styles.maximized : ""}`}>
        <div className={styles.header}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
          <span className={styles.title}>{jobName}</span>
          <button
            className={styles.headerBtn}
            onClick={() => setMaximized(!maximized)}
            title={maximized ? "Restore" : "Maximize"}
          >
            {maximized ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            )}
          </button>
          <button className={styles.headerBtn} onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className={styles.content} ref={contentRef}>
          {loading && <div className={styles.loading}>Loading job log...</div>}
          {error && <div className={styles.error}>{error}</div>}
          {log !== null && (
            <pre
              className={styles.log}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
