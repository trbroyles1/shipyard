"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppStateProvider } from "@/components/providers/AppStateProvider";
import { ToastProvider, useToastContext } from "@/components/providers/ToastProvider";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainContent } from "@/components/layout/MainContent";
import { ToastContainer } from "@/components/notifications/ToastContainer";
import { useAppState } from "@/components/providers/AppStateProvider";
import { useMRList, type MREvent } from "@/hooks/use-mr-list";
import { useNotifications } from "@/hooks/use-notifications";
import { useAudio } from "@/hooks/use-audio";
import styles from "./Dashboard.module.css";

function DashboardInner() {
  const { data: session } = useSession();
  const { updateSelectedMR, pushDetailPatch } = useAppState();
  const { notifications, unreadCount, addNotification, markAllRead } = useNotifications();
  const { toasts, addToast, dismiss } = useToastContext();
  const { playNewMR, playAssignedToMe, playReadyToMerge } = useAudio();

  const currentUserId = session?.gitlabUserId;

  const handleMREvent = useCallback(
    (event: MREvent) => {
      switch (event.type) {
        case "mr-new": {
          const mr = event.data;
          addNotification("New MR", `!${mr.iid} ${mr.title}`);
          addToast("New MR", `!${mr.iid} ${mr.title}`, "info");

          // Check if assigned to current user as reviewer
          if (currentUserId && mr.reviewers.some((r) => r.id === currentUserId)) {
            playAssignedToMe();
          } else {
            playNewMR();
          }
          break;
        }
        case "mr-update": {
          updateSelectedMR(event.data);
          break;
        }
        case "mr-detail-update": {
          pushDetailPatch(event.data);
          break;
        }
        case "mr-ready-to-merge": {
          const mr = event.data;
          // Only notify if current user is the author
          if (currentUserId && mr.author.id === currentUserId) {
            addNotification("Ready to merge", `!${mr.iid} ${mr.title}`);
            addToast("Ready to merge", `!${mr.iid} ${mr.title}`, "success");
            playReadyToMerge();
          }
          break;
        }
      }
    },
    [currentUserId, updateSelectedMR, pushDetailPatch, addNotification, addToast, playNewMR, playAssignedToMe, playReadyToMerge],
  );

  const { mrs, isLoading, error } = useMRList(handleMREvent);

  return (
    <div className={styles.shell}>
      <TopBar
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkRead={markAllRead}
      />
      <div className={styles.body}>
        <Sidebar mrs={mrs} isLoading={isLoading} />
        <MainContent />
      </div>
      {error && (
        <div className={styles.errorBar}>
          Failed to load merge requests: {error}
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export function Dashboard() {
  return (
    <AppStateProvider>
      <ToastProvider>
        <DashboardInner />
      </ToastProvider>
    </AppStateProvider>
  );
}
