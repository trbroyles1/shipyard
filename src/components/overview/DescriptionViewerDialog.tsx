"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { DocumentIcon, ExpandIcon, RestoreIcon, XIcon } from "@/components/shared/icons";
import { MarkdownBody } from "@/components/shared/MarkdownBody";
import styles from "./DescriptionViewerDialog.module.css";

interface Props {
  title: string;
  description: string;
  jiraBaseUrl?: string;
  onClose: () => void;
}

export function DescriptionViewerDialog({ title, description, jiraBaseUrl, onClose }: Props) {
  const [maximized, setMaximized] = useState(false);

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

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={`${styles.dialog} ${maximized ? styles.maximized : ""}`}>
        <div className={styles.header}>
          <DocumentIcon />
          <span className={styles.title}>{title}</span>
          <button
            className={styles.headerBtn}
            onClick={() => setMaximized(!maximized)}
            title={maximized ? "Restore" : "Maximize"}
          >
            {maximized ? <RestoreIcon /> : <ExpandIcon />}
          </button>
          <button className={styles.headerBtn} onClick={onClose} title="Close">
            <XIcon />
          </button>
        </div>
        <div className={styles.content}>
          <MarkdownBody content={description} jiraBaseUrl={jiraBaseUrl} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
