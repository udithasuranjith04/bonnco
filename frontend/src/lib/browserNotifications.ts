// Thin wrapper around the native Notifications Web API. No backend push service — this is a
// personal, local app, so a permission-gated client-side notification is all that's needed to
// alert the user even when the Bonnco tab isn't focused (as long as it's still open).

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

// Must be called from a user gesture (e.g. a Settings toggle click) — browsers largely ignore or
// auto-deny permission requests fired on page load without one.
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  return Notification.requestPermission();
}

export function showBrowserNotification(title: string, body: string, onClick?: () => void): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const n = new Notification(title, { body, icon: "/favicon.svg" });
  if (onClick) {
    n.onclick = () => {
      window.focus();
      onClick();
      n.close();
    };
  }
}
