import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid2";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { useDomainEvents } from "./hooks/useDomainEvents";
import { UserSwitcher } from "./components/UserSwitcher/UserSwitcher";
import { AlertPanel } from "./components/AlertPanel/AlertPanel";
import { EventTimeline } from "./components/EventTimeline/EventTimeline";
import { MempoolWidget } from "./components/MempoolWidget/MempoolWidget";
import { OperationsView } from "./components/OperationsTable/OperationsView";
import { EventHistoryTable } from "./components/EventHistoryTable/EventHistoryTable";
import { CreateAlertRuleForm } from "./components/CreateAlertRuleForm/CreateAlertRuleForm";

/** Cor do chip de status conforme o estado da conexão WS. */
const STATUS_COLOR = {
  open: "success",
  connecting: "warning",
  idle: "default",
} as const;

export function App() {
  const { status } = useDomainEvents();

  return (
    <>
      <AppBar position="static" color="transparent" enableColorOnDark>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h1" component="h1" sx={{ flexGrow: 1 }}>
            Bitcoin Operations Panel
          </Typography>
          <Chip
            label={status}
            color={STATUS_COLOR[status]}
            size="small"
            sx={{ textTransform: "uppercase" }}
          />
          <UserSwitcher />
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <MempoolWidget />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <AlertPanel>
              <AlertPanel.Header>
                <Typography variant="h2" component="h2">
                  Alerts
                </Typography>
              </AlertPanel.Header>
              <AlertPanel.List />
            </AlertPanel>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <CreateAlertRuleForm />
          </Grid>

          <Grid size={12}>
            <EventHistoryTable />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Box>
              <Typography variant="h2" component="h2" sx={{ mb: 1 }}>
                Operations
              </Typography>
              <OperationsView />
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box>
              <Typography variant="h2" component="h2" sx={{ mb: 1 }}>
                Event timeline
              </Typography>
              <EventTimeline />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}
