import { useState, useSyncExternalStore } from "react";
import { getCurrentUserId, setCurrentUserId, onCurrentUserIdChange } from "../../auth/currentUser";

/**
 * @module UserSwitcher
 * @description Input simples para trocar o "usuário atual" — placeholder de auth do
 * frontend (ver `docs/features/frontend-dashboard/plan.md`, Decisão 2). Trocar aqui faz o
 * `WebSocketFeed` reconectar com o novo `connectionParams.userId`.
 */
export function UserSwitcher() {
  const currentUserId = useSyncExternalStore(onCurrentUserIdChange, getCurrentUserId);
  const [draft, setDraft] = useState(currentUserId ?? "");

  return (
    <form
      className="user-switcher"
      onSubmit={(e) => {
        e.preventDefault();
        setCurrentUserId(draft.trim() || null);
      }}
    >
      <label>
        User id
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="users.id from Postgres" />
      </label>
      <button type="submit">Set user</button>
      {currentUserId && <span className="user-switcher__current">Current: {currentUserId}</span>}
    </form>
  );
}
