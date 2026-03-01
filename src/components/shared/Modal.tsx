"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/shared/icons";
import styles from "./Modal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, width }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      style={width ? { width } : undefined}
      onCancel={onClose}
      onClick={handleBackdropClick}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.close} onClick={onClose} title="Close">
            <XIcon size={16} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
