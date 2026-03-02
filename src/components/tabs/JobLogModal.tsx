"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnsiUp } from "ansi_up";
import DOMPurify from "dompurify";
import { apiFetch } from "@/lib/client-errors";
import styles from "./JobLogModal.module.css";

interface Props {
  jobName: string;
  projectId: number;
  pipelineId: number;
  jobId: number;
  jobStatus: string;
  onClose: () => void;
}

const ansi = new AnsiUp();
ansi.use_classes = false;

const POLL_INTERVAL = 3000;
const ACTIVE_STATUSES = new Set(["created", "pending", "running", "preparing", "waiting_for_resource"]);

export function JobLogModal({ jobName, projectId, pipelineId, jobId, jobStatus, onClose }: Props) {
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [liveStatus, setLiveStatus] = useState(jobStatus);
  const contentRef = useRef<HTMLDivElement>(null);
  const byteOffsetRef = useRef(0);
  const autoScrollRef = useRef(true);

  const traceUrl = `/api/gitlab/merge-requests/${projectId}/0/pipelines/${pipelineId}/jobs/${jobId}/trace`;

  // Track whether user has scrolled up (disable auto-scroll)
  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  }, []);

  // Fetch trace data (initial or incremental)
  const fetchTrace = useCallback(async (incremental: boolean) => {
    const headers: Record<string, string> = {};
    if (incremental && byteOffsetRef.current > 0) {
      headers["Range"] = `bytes=${byteOffsetRef.current}-`;
    }

    const res = await apiFetch(traceUrl, { headers });

    if (!res.ok && res.status !== 206) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    const status = res.headers.get("X-Job-Status") || liveStatus;

    // Parse content-range to track byte offset
    const contentRange = res.headers.get("Content-Range");
    if (contentRange) {
      // Format: bytes start-end/total
      const match = contentRange.match(/bytes \d+-(\d+)\/(\d+)/);
      if (match) {
        byteOffsetRef.current = parseInt(match[1], 10) + 1;
      }
    } else if (text.length > 0) {
      // No range support — we got the full content
      byteOffsetRef.current = new Blob([text]).size;
    }

    return { text, status, incremental: res.status === 206 };
  }, [traceUrl, liveStatus]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    setError(null);
    byteOffsetRef.current = 0;

    fetchTrace(false)
      .then(({ text, status }) => {
        setLog(text);
        setLiveStatus(status);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load log"))
      .finally(() => setLoading(false));
  }, [fetchTrace]);

  // Polling for active jobs
  useEffect(() => {
    if (!ACTIVE_STATUSES.has(liveStatus)) return;

    const timer = setInterval(() => {
      fetchTrace(true)
        .then(({ text, status, incremental }) => {
          if (text.length > 0) {
            if (incremental) {
              setLog((prev) => prev + text);
            } else {
              // Server didn't support Range — replace full content
              setLog(text);
            }
          }
          setLiveStatus(status);
        })
        .catch(() => {
          // Silently ignore poll errors — will retry next interval
        });
    }, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [liveStatus, fetchTrace]);

  // Auto-scroll to bottom when log updates
  useEffect(() => {
    if (autoScrollRef.current && contentRef.current) {
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

  const htmlContent = log
    ? DOMPurify.sanitize(ansi.ansi_to_html(log), {
        ALLOWED_TAGS: ["span"],
        ALLOWED_ATTR: ["style", "class"],
      })
    : "";
  const isActive = ACTIVE_STATUSES.has(liveStatus);

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={`${styles.modal} ${maximized ? styles.maximized : ""}`}>
        <div className={styles.header}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
          <span className={styles.title}>{jobName}</span>
          {isActive && (
            <span className={styles.liveIndicator} title={`Job is ${liveStatus}`}>
              LIVE
            </span>
          )}
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
        <div className={styles.content} ref={contentRef} onScroll={handleScroll}>
          {loading && <div className={styles.loading}>Loading job log...</div>}
          {error && <div className={styles.error}>{error}</div>}
          {log.length > 0 && (
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
