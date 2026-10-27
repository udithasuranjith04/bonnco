const SESSION_STORAGE_KEY = "bonnco_chat_session_id";

// One continuous conversation across the whole app — the full Ask Bonnco page and any embedded
// chat widget (e.g. the cockpit sidebar) share this same session id, so asking a quick question
// from the sidebar and later opening the full chat page picks up the same thread rather than
// starting over.
export function newSessionId(): string {
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_STORAGE_KEY, id);
  return id;
}

export function getOrCreateSessionId(): string {
  return localStorage.getItem(SESSION_STORAGE_KEY) ?? newSessionId();
}
