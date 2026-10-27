import { useState } from "react";
import { Badge, Box, Button, IconButton, Popover, Stack, Typography } from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useAlerts } from "../contexts/AlertsContext";
import type { AlertSeverity } from "../contexts/AlertsContext";
import { bonncoColors } from "../theme/theme";

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: bonncoColors.bearish,
  warning: bonncoColors.neutral,
  positive: bonncoColors.bullish,
  info: bonncoColors.accent,
};

const SEVERITY_ICON: Record<AlertSeverity, typeof WarningAmberOutlinedIcon> = {
  critical: WarningAmberOutlinedIcon,
  warning: WarningAmberOutlinedIcon,
  positive: SavingsOutlinedIcon,
  info: BoltOutlinedIcon,
};

function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Enterprise-style notification center — a bell with an unread badge that opens a compact panel,
// rather than a banner competing for space in the page itself. Clicking an alert's action performs
// it directly (e.g. jumps to the prefilled trade form or the active position); the X only dismisses.
export default function NotificationBell() {
  const { alerts, unreadCount, hasUnreadCritical, dismissAlert, markAllRead } = useAlerts();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  function handleOpen(e: React.MouseEvent<HTMLElement>) {
    setAnchorEl(e.currentTarget);
    markAllRead();
  }

  return (
    <>
      <IconButton size="small" onClick={handleOpen} sx={{ color: bonncoColors.textPrimary }}>
        <Badge
          badgeContent={unreadCount}
          max={9}
          sx={{
            "& .MuiBadge-badge": {
              backgroundColor: hasUnreadCritical ? bonncoColors.bearish : bonncoColors.accent,
              color: "#fff",
              fontWeight: 700,
              ...(hasUnreadCritical && { animation: "bonnco-badge-pulse 1.4s ease-in-out infinite" }),
            },
            "@keyframes bonnco-badge-pulse": {
              "0%, 100%": { boxShadow: `0 0 0 0 ${bonncoColors.bearish}66` },
              "50%": { boxShadow: `0 0 0 5px ${bonncoColors.bearish}00` },
            },
          }}
        >
          <NotificationsOutlinedIcon fontSize="small" />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxHeight: "min(480px, calc(100vh - 72px))",
              display: "flex",
              flexDirection: "column",
              backgroundColor: bonncoColors.bgPaper,
              border: `1px solid ${bonncoColors.border}`,
            },
          },
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 2, py: 1.25, borderBottom: `1px solid ${bonncoColors.border}`, flexShrink: 0 }}>
          <Typography fontWeight={700}>Notifications</Typography>
          {alerts.length > 0 && (
            <Typography variant="caption" sx={{ color: bonncoColors.accent }}>
              {unreadCount > 0 ? `${unreadCount} new` : "All read"}
            </Typography>
          )}
        </Stack>

        {alerts.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <NotificationsOutlinedIcon sx={{ color: bonncoColors.textSecondary, fontSize: 28, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No notifications yet
            </Typography>
          </Box>
        ) : (
          <Stack sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {alerts.map((alert) => {
              const color = SEVERITY_COLOR[alert.severity];
              const Icon = SEVERITY_ICON[alert.severity];
              return (
                <Box
                  key={alert.id}
                  sx={{
                    display: "flex",
                    gap: 1.25,
                    px: 2,
                    py: 1.5,
                    borderLeft: `3px solid ${color}`,
                    borderBottom: `1px solid ${bonncoColors.border}`,
                    backgroundColor: alert.read ? "transparent" : `color-mix(in srgb, ${color} 6%, transparent)`,
                  }}
                >
                  <Icon fontSize="small" sx={{ color, flexShrink: 0, mt: 0.25 }} />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {alert.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4, mb: 0.75 }}>
                      {alert.message}
                    </Typography>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                      <Typography variant="caption" color="text.secondary">
                        {timeAgo(alert.createdAt)}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          alert.onAction();
                          setAnchorEl(null);
                        }}
                        sx={{ minWidth: 0, py: 0.25 }}
                      >
                        {alert.actionLabel}
                      </Button>
                    </Stack>
                  </Box>
                  <IconButton size="small" onClick={() => dismissAlert(alert.id)} sx={{ flexShrink: 0, alignSelf: "flex-start" }}>
                    <CloseIcon fontSize="inherit" sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              );
            })}
          </Stack>
        )}
      </Popover>
    </>
  );
}
