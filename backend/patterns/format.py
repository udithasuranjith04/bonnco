def fmt_price(price: float) -> str:
    """Crypto prices span from fractions of a cent to tens of thousands of dollars, so a fixed
    decimal count is wrong at one end or the other — and Python's general "g" format switches to
    scientific notation for anything with 5+ integer digits, which reads as a bug, not a price.
    """
    if price >= 1:
        return f"{price:,.2f}"
    formatted = f"{price:.8f}".rstrip("0")
    if formatted.endswith("."):
        formatted += "0"
    return formatted
