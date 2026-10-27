// A minimal event bridge so an alert's action button (rendered inside NotificationBell, far from
// CockpitWidget in the tree) can open the floating assistant without lifting its open/closed state
// into a new app-wide context just for this one boolean.
const OPEN_ASSISTANT_EVENT = "bonnco:open-assistant";

export function requestOpenAssistant(): void {
  window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_EVENT));
}

export function onOpenAssistantRequested(handler: () => void): () => void {
  window.addEventListener(OPEN_ASSISTANT_EVENT, handler);
  return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, handler);
}
