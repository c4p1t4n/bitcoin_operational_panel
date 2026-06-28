import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { trpcClient } from "../../trpc/client";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const SEVERITIES: readonly Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * @module CreateAlertRuleForm
 * @description Formulário mínimo para `createAlertRule` — única condição `FEE_SPIKE` +
 * ação `TRIGGER_ALERT`, no formato que `RuleDefinitionCompiler` (backend) espera em
 * `configuration`. Outras combinações de condição/ação existem na API mas não têm UI
 * nesta versão (fora de escopo — ver plan.md).
 */
export function CreateAlertRuleForm() {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [threshold, setThreshold] = useState(20);
  const [severity, setSeverity] = useState<Severity>("HIGH");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    try {
      await trpcClient.alerts.createAlertRule.mutate({
        name,
        ruleType: "FEE_SPIKE_ALERT",
        configuration: {
          conditions: [{ type: "FEE_SPIKE", threshold }],
          action: { kind: "TRIGGER_ALERT", title, severity },
        },
      });
      setStatus("done");
      setName("");
      setTitle("");
    } catch (err) {
      console.error("CreateAlertRuleForm: failed to create rule:", err);
      setStatus("error");
    }
  };

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack component="form" spacing={2} onSubmit={submit}>
          <Typography variant="h2" component="h3">
            New fee-spike alert rule
          </Typography>

          <TextField
            size="small"
            label="Rule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            size="small"
            label="Alert title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <TextField
            size="small"
            type="number"
            label="Fee spike threshold (%)"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            slotProps={{ htmlInput: { min: 1, max: 100 } }}
          />
          <TextField
            size="small"
            select
            label="Severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
          >
            {SEVERITIES.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>

          <Button type="submit" variant="contained" disabled={status === "submitting"}>
            {status === "submitting" ? "Creating…" : "Create rule"}
          </Button>

          {status === "done" && <Alert severity="success">Rule created.</Alert>}
          {status === "error" && <Alert severity="error">Failed — check console.</Alert>}
        </Stack>
      </CardContent>
    </Card>
  );
}
