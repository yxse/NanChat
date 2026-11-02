// Trigger for the in-app notification banner (components/app/InAppNotification), usable
// outside React (eg: wallet). Kept free of React imports to avoid circular dependencies.

export type InAppNotificationData = {
  id: number; // changes on every notification so a new one restarts the timer
  title: string;
  body: string;
  address?: string; // shows the profile picture of this account
  icon?: string; // image url, used when there is no address
  url?: string; // opened on tap
};

let listener: ((notification: InAppNotificationData) => void) | null = null;

export const setInAppNotificationListener = (fn: typeof listener) => {
  listener = fn;
};

// Returns false when no banner is mounted, so callers can fall back to a toast
export const showInAppNotification = (notification: Omit<InAppNotificationData, "id">) => {
  if (!listener) return false;
  listener({ ...notification, id: Date.now() });
  return true;
};
