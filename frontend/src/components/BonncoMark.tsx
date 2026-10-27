import { bonncoColors } from "../theme/theme";

// A small ascending-bar glyph (market data, not a generic gradient blob) on a dark badge —
// the same mark used for the sidebar logo and the favicon, kept in sync by hand since favicons
// can't share a React component.
export default function BonncoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="30" height="30" rx="6" fill={bonncoColors.bgDefault} stroke={bonncoColors.border} strokeWidth="1" />
      <rect x="7" y="15" width="4.5" height="9" rx="1" fill={bonncoColors.accent} opacity="0.55" />
      <rect x="13.75" y="10" width="4.5" height="14" rx="1" fill={bonncoColors.accent} opacity="0.85" />
      <rect x="20.5" y="5" width="4.5" height="19" rx="1" fill={bonncoColors.bullish} />
    </svg>
  );
}
