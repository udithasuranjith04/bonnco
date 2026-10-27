import { useEffect, useMemo, useState } from "react";
import { Box, Card, Chip, CircularProgress, Link as MuiLink, Stack, Typography } from "@mui/material";
import { fetchWhaleActivity } from "../api/client";
import type { WhaleActivityOut } from "../api/client";
import LastUpdated from "../components/LastUpdated";
import { bonncoColors, monoStack } from "../theme/theme";

const REFRESH_INTERVAL_MS = 60_000;
const ROW_GRID = "70px 70px minmax(0, 1fr) 130px 70px";

const CHAIN_LABEL: Record<string, string> = { ethereum: "Ethereum", solana: "Solana", bitcoin: "Bitcoin" };
const CHAIN_COLOR: Record<string, string> = {
  ethereum: bonncoColors.accent,
  solana: bonncoColors.bullish,
  bitcoin: "#F7931A",
};
const EXPLORER_BASE: Record<string, string> = {
  ethereum: "https://etherscan.io/tx/",
  solana: "https://solscan.io/tx/",
  bitcoin: "https://mempool.space/tx/",
};

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ fontFamily: monoStack, letterSpacing: "0.08em", color: bonncoColors.textSecondary, display: "block", mb: 1 }}
    >
      {children}
    </Typography>
  );
}

export default function WhaleActivityPage() {
  const [chainFilter, setChainFilter] = useState<"all" | "ethereum" | "solana" | "bitcoin">("all");
  const [events, setEvents] = useState<WhaleActivityOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchWhaleActivity(chainFilter === "all" ? undefined : chainFilter, 24, 100).then((data) => {
        if (cancelled) return;
        setEvents(data);
        setLoading(false);
        setLastUpdated(new Date());
      });
    }
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chainFilter]);

  const totalUsd = useMemo(() => events.reduce((sum, e) => sum + e.amount_usd, 0), [events]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 112px)" }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          Whale Activity
        </Typography>
        <LastUpdated timestamp={lastUpdated} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Large on-chain transfers from free public sources: Bitcoin and Ethereum are scanned block by block in full,
        Solana is sampled via public RPC due to block size. Real, verifiable transactions, not estimates.
      </Typography>

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, flexGrow: 1, minHeight: 0 }}>
        <Stack sx={{ width: { xs: "100%", md: 220 }, flexShrink: 0, gap: 1.5 }}>
          <Card sx={{ p: 1.75 }}>
            <SectionLabel>CHAIN</SectionLabel>
            <Stack sx={{ gap: 0.4 }}>
              {(["all", "ethereum", "solana", "bitcoin"] as const).map((c) => (
                <Box
                  key={c}
                  onClick={() => setChainFilter(c)}
                  sx={{
                    cursor: "pointer",
                    borderRadius: 1,
                    px: 1,
                    py: 0.65,
                    fontSize: 14,
                    fontWeight: 600,
                    backgroundColor: chainFilter === c ? bonncoColors.bgElevated : "transparent",
                    color: chainFilter === c ? bonncoColors.textPrimary : bonncoColors.textSecondary,
                    "&:hover": { backgroundColor: bonncoColors.bgElevated },
                  }}
                >
                  {c === "all" ? "All chains" : CHAIN_LABEL[c]}
                </Box>
              ))}
            </Stack>
          </Card>

          <Card sx={{ p: 1.75 }}>
            <SectionLabel>LAST 24H</SectionLabel>
            <Typography variant="h6" sx={{ fontFamily: monoStack, fontWeight: 700 }}>
              {fmtUsd(totalUsd)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              across {events.length} tracked transfer{events.length === 1 ? "" : "s"}
            </Typography>
          </Card>
        </Stack>

        <Card sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", p: 0, borderRadius: 1.5 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: ROW_GRID,
              gap: 2,
              px: 2.5,
              py: 1,
              borderBottom: `1px solid ${bonncoColors.border}`,
              backgroundColor: bonncoColors.bgElevated,
            }}
          >
            <SectionLabel>CHAIN</SectionLabel>
            <SectionLabel>ASSET</SectionLabel>
            <SectionLabel>FROM / TO</SectionLabel>
            <SectionLabel>AMOUNT</SectionLabel>
            <SectionLabel>TIME</SectionLabel>
          </Box>

          <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
            {loading && (
              <Stack sx={{ alignItems: "center", py: 6 }}>
                <CircularProgress size={22} />
              </Stack>
            )}

            {!loading && events.length === 0 && (
              <Stack sx={{ alignItems: "center", py: 6, px: 3, gap: 0.5 }}>
                <Typography color="text.secondary" sx={{ textAlign: "center" }}>
                  No whale transfers recorded in the last 24h.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
                  Whale-sized transfers are genuinely rare, and this samples on-chain activity rather than watching
                  every single transaction, so gaps between sightings are expected, not a sign of anything broken.
                </Typography>
              </Stack>
            )}

            {events.map((e) => (
              <Box
                key={e.id}
                className="bonnco-msg-in"
                sx={{
                  display: "grid",
                  gridTemplateColumns: ROW_GRID,
                  gap: 2,
                  alignItems: "center",
                  px: 2.5,
                  py: 1.25,
                  borderBottom: `1px solid ${bonncoColors.border}`,
                  "&:hover": { backgroundColor: bonncoColors.bgElevated },
                }}
              >
                <Chip
                  label={CHAIN_LABEL[e.chain]}
                  size="small"
                  sx={{ backgroundColor: `${CHAIN_COLOR[e.chain]}22`, color: CHAIN_COLOR[e.chain], fontWeight: 700, fontSize: 11 }}
                />
                <Typography variant="body2" fontWeight={700}>
                  {e.asset}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
                  {fmtAddress(e.from_address)} → {fmtAddress(e.to_address)}
                </Typography>
                <Box>
                  <Typography variant="body2" sx={{ fontFamily: monoStack, fontWeight: 700 }}>
                    {fmtUsd(e.amount_usd)}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
                    {e.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {e.asset}
                  </Typography>
                </Box>
                <Stack sx={{ alignItems: "flex-end", gap: 0.25 }}>
                  <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
                    {timeAgo(e.event_time)} ago
                  </Typography>
                  {e.tx_hash && (
                    <MuiLink
                      href={`${EXPLORER_BASE[e.chain]}${e.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      sx={{ fontSize: 11, color: bonncoColors.accent }}
                    >
                      view tx
                    </MuiLink>
                  )}
                </Stack>
              </Box>
            ))}
          </Box>
        </Card>
      </Box>
    </Box>
  );
}
