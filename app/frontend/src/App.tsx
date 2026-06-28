import { useDomainEvents } from "./hooks/useDomainEvents";
import { UserSwitcher } from "./components/UserSwitcher/UserSwitcher";
import { AlertPanel } from "./components/AlertPanel/AlertPanel";
import { EventTimeline } from "./components/EventTimeline/EventTimeline";
import { MempoolWidget } from "./components/MempoolWidget/MempoolWidget";
import { OperationsView } from "./components/OperationsTable/OperationsView";
import { CreateAlertRuleForm } from "./components/CreateAlertRuleForm/CreateAlertRuleForm";

export function App() {
  const { status } = useDomainEvents();

  return (
    <main className="app">
      <header className="app__header">
        <h1>Bitcoin Operations Panel</h1>
        <span className={`app__connection app__connection--${status}`}>{status}</span>
        <UserSwitcher />
      </header>

      <section className="app__grid">
        <MempoolWidget />

        <AlertPanel>
          <AlertPanel.Header>
            <h2>Alerts</h2>
          </AlertPanel.Header>
          <AlertPanel.List />
        </AlertPanel>

        <CreateAlertRuleForm />
      </section>

      <section className="app__row">
        <div>
          <h2>Operations</h2>
          <OperationsView />
        </div>
        <div>
          <h2>Event timeline</h2>
          <EventTimeline />
        </div>
      </section>
    </main>
  );
}
