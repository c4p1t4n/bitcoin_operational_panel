import { useState } from "react";
import { trpcClient } from "../../trpc/client";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

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
    <form className="create-alert-rule-form" onSubmit={submit}>
      <h3>New fee-spike alert rule</h3>
      <label>
        Rule name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Alert title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Fee spike threshold (%)
        <input
          type="number"
          min={1}
          max={100}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
      </label>
      <label>
        Severity
        <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>
      </label>
      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Creating..." : "Create rule"}
      </button>
      {status === "done" && <p className="create-alert-rule-form__success">Rule created.</p>}
      {status === "error" && <p className="create-alert-rule-form__error">Failed — check console.</p>}
    </form>
  );
}
