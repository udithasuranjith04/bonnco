QUOTE_SUFFIXES = ("USDT", "FDUSD", "USDC", "BUSD", "TUSD", "USD")


def base_asset(symbol: str) -> str:
    for suffix in QUOTE_SUFFIXES:
        if symbol.endswith(suffix) and len(symbol) > len(suffix):
            return symbol[: -len(suffix)]
    return symbol
