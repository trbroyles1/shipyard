"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { AppStateProvider } from "@/components/providers/AppStateProvider";
import { PreferencesProvider, usePreferencesContext } from "@/components/providers/PreferencesProvider";
import { ToastProvider, useToastContext } from "@/components/providers/ToastProvider";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainContent } from "@/components/layout/MainContent";
import { ToastContainer } from "@/components/notifications/ToastContainer";
import { useAppState } from "@/components/providers/AppStateProvider";
import { AUTH_EXPIRED_EVENT } from "@/lib/client-errors";
import { SSE_ERROR_AUTH_EXPIRED } from "@/lib/errors";
import { useMRList, type MREvent } from "@/hooks/use-mr-list";
import { useNotifications } from "@/hooks/use-notifications";
import { useAudio } from "@/hooks/use-audio";
import { SessionDisplacedOverlay } from "@/components/SessionDisplacedOverlay";
import styles from "./Dashboard.module.css";

const SIGN_IN_URL = "/auth/signin";

function DashboardInner() {
  const { data: session } = useSession();
  const { updateSelectedMR, pushDetailPatch } = useAppState();
  const { notifications, unreadCount, addNotification, markAllRead } = useNotifications();
  const { toasts, addToast, dismiss } = useToastContext();
  const { preferences } = usePreferencesContext();
  const { playNewMR, playAssignedToMe, playReadyToMerge } = useAudio();
  const degradedToastShownRef = useRef(false);

  const currentUserId = session?.gitlabUserId;

  // Global 401 handling — any apiFetch that gets a 401 dispatches this event
  useEffect(() => {
    const handleAuthExpired = () => {
      signOut({ callbackUrl: SIGN_IN_URL });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const handleMREvent = useCallback(
    (event: MREvent) => {
      switch (event.type) {
        case "mr-new": {
          const mr = event.data;
          const isAssigned = currentUserId && mr.reviewers.some((r) => r.id === currentUserId);

          if (isAssigned && preferences.notifyAssigned) {
            addNotification("Assigned to you", `!${mr.iid} ${mr.title}`);
            addToast("Assigned to you", `!${mr.iid} ${mr.title}`, "info");
            if (preferences.soundNewMR) playAssignedToMe();
          } else if (preferences.notifyNewMR) {
            addNotification("New MR", `!${mr.iid} ${mr.title}`);
            addToast("New MR", `!${mr.iid} ${mr.title}`, "info");
            if (preferences.soundNewMR) playNewMR();
          }
          break;
        }
        case "mr-update": {
          updateSelectedMR(event.data);
          break;
        }
        case "mr-detail-update": {
          console.debug("[Dashboard] mr-detail-update received, approved_by:", event.data.approvals.approved_by.map(a => a.user.id));
          pushDetailPatch(event.data);
          break;
        }
        case "mr-ready-to-merge": {
          const mr = event.data;
          if (preferences.notifyReadyToMerge && currentUserId && mr.author.id === currentUserId) {
            addNotification("Ready to merge", `!${mr.iid} ${mr.title}`);
            addToast("Ready to merge", `!${mr.iid} ${mr.title}`, "success");
            playReadyToMerge();
          }
          break;
        }
        case "error": {
          const { code } = event.data;
          if (code === SSE_ERROR_AUTH_EXPIRED) {
            signOut({ callbackUrl: SIGN_IN_URL });
          }
          break;
        }
        case "warning": {
          if (!degradedToastShownRef.current) {
            addToast("Connection Issue", event.data.message, "warning");
            degradedToastShownRef.current = true;
          }
          break;
        }
      }
    },
    [currentUserId, preferences, updateSelectedMR, pushDetailPatch, addNotification, addToast, playNewMR, playAssignedToMe, playReadyToMerge],
  );

  const { mrs, isLoading, connectionHealth, isDisplaced } = useMRList(handleMREvent);

  // Reset degraded toast flag when connection recovers
  useEffect(() => {
    if (connectionHealth === "connected") {
      degradedToastShownRef.current = false;
    }
  }, [connectionHealth]);

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
      {connectionHealth === "error" && (
        <div className={styles.errorBar}>
          Lost connection to GitLab.
        </div>
      )}
      {connectionHealth === "degraded" && (
        <div className={styles.warningBar}>
          Having trouble reaching GitLab. Data may be stale.
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      {isDisplaced && <SessionDisplacedOverlay />}
    </div>
  );
}

export function Dashboard() {
  return (
    <AppStateProvider>
      <PreferencesProvider>
        <ToastProvider>
          <DashboardInner />
        </ToastProvider>
      </PreferencesProvider>
    </AppStateProvider>
  );
}
