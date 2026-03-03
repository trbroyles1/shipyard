"use client";

import { useState, useRef, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import { SIGN_IN_PATH } from "@/lib/constants";
import { useClickOutside } from "@/hooks/use-click-outside";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { RocketIcon, UserIcon, SettingsIcon, SignOutIcon } from "@/components/shared/icons";
import { PreferencesModal } from "@/components/user/PreferencesModal";
import type { Notification } from "@/hooks/use-notifications";
import styles from "./TopBar.module.css";

interface Props {
  notifications: Notification[];
  unreadCount: number;
  onMarkRead: () => void;
}

export function TopBar({ notifications, unreadCount, onMarkRead }: Props) {
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setUserMenuOpen(false), []);
  useClickOutside(menuRef, closeMenu);

  return (
    <>
    <header className={styles.topbar}>
      <div className={styles.left}>
        <div className={styles.logo}>
          <RocketIcon size={22} />
        </div>
        <span className={styles.title}>Shipyard</span>
      </div>
      <div className={styles.right}>
        <div ref={notifRef} className={styles.dropdownAnchor}>
          <NotificationBell
            unreadCount={unreadCount}
            onClick={() => setNotifPanelOpen(!notifPanelOpen)}
          />
          {notifPanelOpen && (
            <NotificationPanel
              notifications={notifications}
              onClose={() => setNotifPanelOpen(false)}
              onMarkRead={onMarkRead}
            />
          )}
        </div>
        <div ref={menuRef} className={styles.dropdownAnchor}>
          <button
            className={styles.iconBtn}
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            title="User menu"
          >
            <UserIcon />
          </button>
          {userMenuOpen && (
            <div className={styles.userMenu}>
              <div className={styles.userMenuHeader}>
                <div className={styles.userName}>{session?.user?.name || "User"}</div>
                <div className={styles.userHandle}>@{session?.user?.email?.split("@")[0] || "user"}</div>
              </div>
              <button
                className={styles.userMenuItem}
                onClick={() => { setUserMenuOpen(false); setPrefsOpen(true); }}
              >
                <SettingsIcon />
                Preferences
              </button>
              <button
                className={styles.userMenuItem}
                onClick={() => signOut({ callbackUrl: SIGN_IN_PATH })}
              >
                <SignOutIcon />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </>
  );
}
