import { useEffect, useState } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { AppBar, Box, MenuItem, Select, Stack, Toolbar, Typography } from "@mui/material";
import StarSharpIcon from "@mui/icons-material/StarSharp";
import CandlestickChartSharpIcon from "@mui/icons-material/CandlestickChartSharp";
import ChatBubbleSharpIcon from "@mui/icons-material/ChatBubbleSharp";
import MenuBookSharpIcon from "@mui/icons-material/MenuBookSharp";
import InsightsSharpIcon from "@mui/icons-material/InsightsSharp";
import PieChartSharpIcon from "@mui/icons-material/PieChartSharp";
import NewspaperSharpIcon from "@mui/icons-material/NewspaperSharp";
import WavesSharpIcon from "@mui/icons-material/WavesSharp";
import SchoolSharpIcon from "@mui/icons-material/SchoolSharp";
import SettingsSharpIcon from "@mui/icons-material/SettingsSharp";
import CircleIcon from "@mui/icons-material/Circle";
import { apiClient } from "../api/client";
import type { RiskProfile } from "../api/client";
import { bonncoColors, monoStack, riskProfileColor, serifStack } from "../theme/theme";
import SymbolSearchBar from "../components/SymbolSearchBar";
import BonncoMark from "../components/BonncoMark";
import NavDropdown from "../components/NavDropdown";
import NotificationBell from "../components/NotificationBell";
import WatchlistStrip from "../components/WatchlistStrip";
import SessionCheckinModal from "../components/SessionCheckinModal";
import GoalNavIndicator from "../components/GoalNavIndicator";
import CockpitWidget from "../components/CockpitWidget";
import { useRiskProfile } from "../contexts/RiskProfileContext";
import useSignalWatcher from "../hooks/useSignalWatcher";
import usePositionWatcher from "../hooks/usePositionWatcher";

const CONNECTION_CHECK_INTERVAL_MS = 30_000;

const NAV_SECTIONS = [
  {
    id: "account",
    label: "Account",
    items: [
      { id: "/", label: "Dashboard", icon: <PieChartSharpIcon fontSize="small" /> },
      { id: "/journal", label: "Trade Journal", icon: <MenuBookSharpIcon fontSize="small" /> },
      { id: "/performance", label: "Performance", icon: <InsightsSharpIcon fontSize="small" /> },
      { id: "/settings", label: "Settings", icon: <SettingsSharpIcon fontSize="small" /> },
    ],
  },
  {
    id: "market",
    label: "Market",
    items: [
      { id: "/watchlist", label: "Watchlist", icon: <StarSharpIcon fontSize="small" /> },
      { id: "/coin/BTCUSDT", label: "Coin Detail", icon: <CandlestickChartSharpIcon fontSize="small" /> },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { id: "/chat", label: "Ask Bonnco", icon: <ChatBubbleSharpIcon fontSize="small" /> },
      { id: "/news", label: "News Feed", icon: <NewspaperSharpIcon fontSize="small" /> },
      { id: "/whales", label: "Whale Activity", icon: <WavesSharpIcon fontSize="small" /> },
      { id: "/study", label: "Study", icon: <SchoolSharpIcon fontSize="small" /> },
    ],
  },
] as const;

function sectionMatchesPath(section: (typeof NAV_SECTIONS)[number], pathname: string): boolean {
  return section.items.some((item) => (item.id === "/" ? pathname === "/" : pathname.startsWith(item.id.split("/").slice(0, 2).join("/"))));
}

export default function AppLayout() {
  const { riskProfile: riskMode, setRiskProfile } = useRiskProfile();
  const [connected, setConnected] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkConnection = () => {
      apiClient
        .get("/api/market/price/BTCUSDT", { params: { market_type: "spot" } })
        .then(() => setConnected(true))
        .catch(() => setConnected(false));
    };
    checkConnection();
    const interval = setInterval(checkConnection, CONNECTION_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useSignalWatcher();
  usePositionWatcher();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <SessionCheckinModal />
      <Box
        aria-hidden
        sx={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1350,
          boxShadow: `inset 0 0 0 2px ${riskProfileColor[riskMode]}66, inset 0 0 46px 0 ${riskProfileColor[riskMode]}26`,
          transition: "box-shadow 500ms ease",
        }}
      />

      <AppBar position="sticky" elevation={0} color="transparent">
        <Toolbar sx={{ display: "flex", alignItems: "center", gap: 2, py: 1 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, flexShrink: 0 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mr: 0.5, flexShrink: 0 }}>
              <BonncoMark size={24} />
              <Typography variant="h6" sx={{ fontFamily: serifStack, fontWeight: 700, letterSpacing: "0.005em", fontSize: 18 }}>
                Bonnco
              </Typography>
            </Stack>
            <Box sx={{ width: "1px", height: 22, backgroundColor: bonncoColors.border, mr: 0.5, flexShrink: 0 }} />
            {NAV_SECTIONS.map((section) => (
              <NavDropdown
                key={section.id}
                label={section.label}
                active={sectionMatchesPath(section, location.pathname)}
                items={section.items.map((item) => ({ id: item.id, label: item.label, icon: item.icon }))}
                onSelect={(id) => navigate(id)}
              />
            ))}
          </Stack>

          <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
            <Box sx={{ width: "100%", maxWidth: 460 }}>
              <SymbolSearchBar />
            </Box>
          </Box>

          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "flex-end", gap: 1.25, flexShrink: 0 }}>
            <GoalNavIndicator />
            <NotificationBell />

            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                gap: 0.6,
                px: 1.1,
                py: 0.6,
                borderRadius: 1.5,
                backgroundColor: bonncoColors.bgElevated,
                flexShrink: 0,
              }}
            >
              <CircleIcon sx={{ fontSize: "7px !important", color: connected ? bonncoColors.bullish : bonncoColors.bearish }} />
              <Typography
                variant="caption"
                sx={{ fontFamily: monoStack, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", color: connected ? bonncoColors.bullish : bonncoColors.bearish }}
              >
                {connected ? "LIVE" : "DOWN"}
              </Typography>
            </Stack>

            <Select
              size="small"
              value={riskMode}
              onChange={(e) => setRiskProfile(e.target.value as RiskProfile)}
              sx={{
                minWidth: 130,
                fontSize: 13,
                fontWeight: 600,
                backgroundColor: bonncoColors.bgElevated,
                "& .MuiSelect-select": { py: 0.75 },
              }}
            >
              <MenuItem value="conservative">Conservative</MenuItem>
              <MenuItem value="moderate">Moderate</MenuItem>
              <MenuItem value="aggressive">Aggressive</MenuItem>
            </Select>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ position: "sticky", top: 0, zIndex: 1100 }}>
        <WatchlistStrip />
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: "auto",
          px: { xs: 2, sm: 3, md: 5, lg: 8 },
          py: 3,
        }}
      >
        <Box sx={{ maxWidth: 1800, width: "100%", height: "100%", mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>

      <CockpitWidget />
    </Box>
  );
}
