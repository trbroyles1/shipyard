"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { MRSelectionProvider, useMRSelection } from "@/components/providers/MRSelectionProvider";
import { DetailPatchProvider, useDetailPatch } from "@/components/providers/DetailPatchProvider";
import { FilterSortProvider } from "@/components/providers/FilterSortProvider";
import { UIPanelProvider } from "@/components/providers/UIPanelProvider";
import { PreferencesProvider, usePreferencesContext } from "@/components/providers/PreferencesProvider";
import { ToastProvider, useToastContext } from "@/components/providers/ToastProvider";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainContent } from "@/components/layout/MainContent";
import { ToastContainer } from "@/components/notifications/ToastContainer";
import { AUTH_EXPIRED_EVENT } from "@/lib/client-errors";
import { SSE_ERROR_AUTH_EXPIRED } from "@/lib/errors";
import { SIGN_IN_PATH } from "@/lib/constants";
import type { MRSummary } from "@/lib/types/mr";
import { useMRList, type MREvent } from "@/hooks/use-mr-list";
import { useNotifications } from "@/hooks/use-notifications";
import { useAudio } from "@/hooks/use-audio";
import { SessionDisplacedOverlay } from "@/components/SessionDisplacedOverlay";
import { createLogger } from "@/lib/logger";
import styles from "./Dashboard.module.css";

const log = createLogger("Dashboard");

function DashboardInner() {
  const { data: session } = useSession();
  const { updateSelectedMR } = useMRSelection();
  const { pushDetailPatch } = useDetailPatch();
  const { notifications, unreadCount, addNotification, markAllRead } = useNotifications();
  const { toasts, addToast, dismiss } = useToastContext();
  const { preferences } = usePreferencesContext();
  const { playNewMR, playAssignedToMe, playReadyToMerge } = useAudio();
  const degradedToastShownRef = useRef(false);

  const currentUserId = session?.gitlabUserId;

  // Global 401 handling — any apiFetch that gets a 401 dispatches this event
  useEffect(() => {
    const handleAuthExpired = () => {
      signOut({ callbackUrl: SIGN_IN_PATH });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const handleNewMR = useCallback(
    (mr: MRSummary) => {
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
    },
    [currentUserId, preferences, addNotification, addToast, playAssignedToMe, playNewMR],
  );

  const handleReadyToMerge = useCallback(
    (mr: MRSummary) => {
      if (preferences.notifyReadyToMerge && currentUserId && mr.author.id === currentUserId) {
        addNotification("Ready to merge", `!${mr.iid} ${mr.title}`);
        addToast("Ready to merge", `!${mr.iid} ${mr.title}`, "success");
        playReadyToMerge();
      }
    },
    [currentUserId, preferences, addNotification, addToast, playReadyToMerge],
  );

  const handleMREvent = useCallback(
    (event: MREvent) => {
      switch (event.type) {
        case "mr-new": {
          handleNewMR(event.data);
          break;
        }
        case "mr-update": {
          updateSelectedMR(event.data);
          break;
        }
        case "mr-detail-update": {
          log.debug(`mr-detail-update received, approved_by: ${event.data.approvals.approved_by.map((a: { user: { id: number } }) => a.user.id)}`);
          pushDetailPatch(event.data);
          break;
        }
        case "mr-ready-to-merge": {
          handleReadyToMerge(event.data);
          break;
        }
        case "error": {
          const { code } = event.data;
          if (code === SSE_ERROR_AUTH_EXPIRED) {
            signOut({ callbackUrl: SIGN_IN_PATH });
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
    [handleNewMR, handleReadyToMerge, updateSelectedMR, pushDetailPatch, addToast],
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
    <MRSelectionProvider>
      <DetailPatchProvider>
        <FilterSortProvider>
          <UIPanelProvider>
            <PreferencesProvider>
              <ToastProvider>
                <DashboardInner />
              </ToastProvider>
            </PreferencesProvider>
          </UIPanelProvider>
        </FilterSortProvider>
      </DetailPatchProvider>
    </MRSelectionProvider>
  );
}
