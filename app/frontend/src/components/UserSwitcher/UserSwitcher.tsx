import { useState, useSyncExternalStore } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
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
    <Stack
      component="form"
      direction="row"
      spacing={1}
      alignItems="center"
      onSubmit={(e) => {
        e.preventDefault();
        setCurrentUserId(draft.trim() || null);
      }}
    >
      <Tooltip title={currentUserId ? `Current: ${currentUserId}` : "No user set"}>
        <TextField
          size="small"
          label="User id"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="users.id from Postgres"
          sx={{ minWidth: 200 }}
        />
      </Tooltip>
      <Button type="submit" variant="contained" size="small">
        Set user
      </Button>
    </Stack>
  );
}
