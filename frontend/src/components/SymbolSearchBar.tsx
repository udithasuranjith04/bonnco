import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Autocomplete, Box, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { fetchTopSymbols, searchSymbols } from "../api/client";
import type { MarketType, TopSymbolOut } from "../api/client";
import CoinIcon from "./CoinIcon";
import { bonncoColors } from "../theme/theme";

const DEBOUNCE_MS = 300;
const BROWSE_LIMIT = 50;

export default function SymbolSearchBar() {
  const [marketType, setMarketType] = useState<MarketType>("spot");
  const [query, setQuery] = useState("");
  const [browseOptions, setBrowseOptions] = useState<TopSymbolOut[]>([]);
  const [searchResults, setSearchResults] = useState<TopSymbolOut[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // A full, scrollable list to browse the moment the dropdown opens — not just blank until typing.
  useEffect(() => {
    fetchTopSymbols(marketType, BROWSE_LIMIT).then(setBrowseOptions);
  }, [marketType]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      searchSymbols(query, marketType, 20)
        .then(setSearchResults)
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, marketType]);

  const options = query.trim() ? searchResults : browseOptions;

  function handleSelect(symbol: string | null) {
    if (!symbol) return;
    navigate(`/coin/${symbol}?market_type=${marketType}`);
    setQuery("");
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1, maxWidth: 460 }}>
      <Autocomplete
        size="small"
        options={options}
        loading={loading}
        filterOptions={(x) => x}
        getOptionLabel={(o) => o.symbol}
        inputValue={query}
        onInputChange={(_, value) => setQuery(value)}
        onChange={(_, value) => handleSelect(value?.symbol ?? null)}
        noOptionsText={query ? "No matching symbols" : "Loading coins…"}
        slotProps={{ listbox: { sx: { maxHeight: 320 } } }}
        renderOption={(props, option) => {
          const isUp = option.price_change_percent >= 0;
          return (
            <Box
              component="li"
              {...props}
              key={option.symbol}
              sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "space-between" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CoinIcon symbol={option.symbol} size={18} />
                <Typography variant="body2" fontWeight={600}>
                  {option.symbol}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{ color: isUp ? bonncoColors.bullish : bonncoColors.bearish, fontWeight: 700 }}
              >
                {isUp ? "+" : ""}
                {option.price_change_percent.toFixed(2)}%
              </Typography>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search coin (e.g. SOL)"
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: bonncoColors.bgElevated,
                borderRadius: 2,
                fontSize: 14,
              },
              "& .MuiOutlinedInput-notchedOutline": { border: "none" },
            }}
          />
        )}
        sx={{ flexGrow: 1 }}
      />

      <ToggleButtonGroup
        size="small"
        exclusive
        value={marketType}
        onChange={(_, value) => value && setMarketType(value)}
        sx={{ flexShrink: 0 }}
      >
        <ToggleButton value="spot" sx={{ px: 1.25, py: 0.5, fontSize: 12 }}>
          Spot
        </ToggleButton>
        <ToggleButton value="futures" sx={{ px: 1.25, py: 0.5, fontSize: 12 }}>
          Futures
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
