import { useEffect, useState } from "react";
import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import { fetchTopSymbols, searchSymbols } from "../api/client";
import type { MarketType, TopSymbolOut } from "../api/client";
import CoinIcon from "./CoinIcon";
import { bonncoColors } from "../theme/theme";

const DEBOUNCE_MS = 300;
const BROWSE_LIMIT = 50;

export default function SymbolPicker({
  value,
  onChange,
  marketType,
  placeholder = "Search or browse coins",
}: {
  value: string | null;
  onChange: (symbol: string | null) => void;
  marketType: MarketType;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [browseOptions, setBrowseOptions] = useState<TopSymbolOut[]>([]);
  const [searchResults, setSearchResults] = useState<TopSymbolOut[]>([]);
  const [loading, setLoading] = useState(false);

  // Populated once per market type so opening the dropdown with an empty query still shows a
  // full, scrollable list to browse — not just a blank box until you start typing.
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

  return (
    <Autocomplete
      size="small"
      options={options}
      loading={loading}
      filterOptions={(x) => x}
      getOptionLabel={(o) => (typeof o === "string" ? o : o.symbol)}
      value={value ? ({ symbol: value } as TopSymbolOut) : null}
      inputValue={query}
      onInputChange={(_, v) => setQuery(v)}
      onChange={(_, v) => onChange(typeof v === "string" ? v : v?.symbol ?? null)}
      isOptionEqualToValue={(o, v) => o.symbol === v.symbol}
      noOptionsText={query ? "No matching symbols on Binance" : "Loading coins…"}
      slotProps={{ listbox: { sx: { maxHeight: 320 } } }}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.symbol} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CoinIcon symbol={option.symbol} size={18} />
          <Typography variant="body2" fontWeight={600}>
            {option.symbol}
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder={placeholder}
          sx={{
            width: 220,
            "& .MuiOutlinedInput-root": { backgroundColor: bonncoColors.bgElevated },
          }}
        />
      )}
    />
  );
}
