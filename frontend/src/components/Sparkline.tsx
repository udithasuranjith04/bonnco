import { useId } from "react";
import { bonncoColors } from "../theme/theme";

export default function Sparkline({
  data,
  width = 100,
  height = 32,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  const gradientId = useId();

  if (data.length < 2) {
    return <svg width={width} height={height} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const coords = data.map((value, i) => ({
    x: i * step,
    y: height - ((value - min) / range) * height,
  }));

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const fillPath = `M0,${height} L${linePoints
    .split(" ")
    .map((p) => p)
    .join(" L")} L${width},${height} Z`;

  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? bonncoColors.bullish : bonncoColors.bearish;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} stroke="none" />
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
