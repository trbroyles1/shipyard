"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnsiUp } from "ansi_up";
import DOMPurify from "dompurify";
import { apiFetch } from "@/lib/client-errors";
import { HEADER_JOB_STATUS } from "@/lib/constants";
import { TerminalIcon, ExpandIcon, RestoreIcon, XIcon } from "@/components/shared/icons";
import styles from "./JobLogModal.module.css";

interface Props {
  jobName: string;
  projectId: number;
  jobId: number;
  jobStatus: string;
  onClose: () => void;
}

const ansi = new AnsiUp();
ansi.use_classes = false;

const POLL_INTERVAL = 3000;
const ACTIVE_STATUSES = new Set(["created", "pending", "running", "preparing", "waiting_for_resource"]);

export function JobLogModal({ jobName, projectId, jobId, jobStatus, onClose }: Props) {
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [liveStatus, setLiveStatus] = useState(jobStatus);
  const liveStatusRef = useRef(jobStatus);
  const contentRef = useRef<HTMLDivElement>(null);
  const byteOffsetRef = useRef(0);
  const autoScrollRef = useRef(true);

  // Keep ref in sync so fetchTrace can read current status without being a dep
  liveStatusRef.current = liveStatus;

  const traceUrl = `/api/gitlab/projects/${projectId}/jobs/${jobId}/trace`;

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
    const status = res.headers.get(HEADER_JOB_STATUS) || liveStatusRef.current;

    // Parse content-range to track byte offset
    const contentRange = res.headers.get("Content-Range");
    if (contentRange) {
      // Format: bytes start-end/total
      const match = contentRange.match(/bytes \d+-(\d+)\/(\d+)/);
      if (match) {
        byteOffsetRef.current = Number.parseInt(match[1], 10) + 1;
      }
    } else if (text.length > 0) {
      // No range support — we got the full content
      byteOffsetRef.current = new Blob([text]).size;
    }

    return { text, status, incremental: res.status === 206 };
  }, [traceUrl]);

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

    function handlePollResult({ text, status, incremental }: { text: string; status: string; incremental: boolean }) {
      if (text.length > 0) {
        if (incremental) {
          setLog((prev) => prev + text);
        } else {
          // Server didn't support Range — replace full content
          setLog(text);
        }
      }
      setLiveStatus(status);
    }

    const timer = setInterval(() => {
      fetchTrace(true).then(handlePollResult).catch(() => {
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
          <TerminalIcon size={14} />
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
              <RestoreIcon size={14} />
            ) : (
              <ExpandIcon size={14} />
            )}
          </button>
          <button className={styles.headerBtn} onClick={onClose} title="Close">
            <XIcon size={14} />
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
