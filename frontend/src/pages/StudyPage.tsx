import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Card, Chip, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PatternDiagram from "../components/PatternDiagram";
import CandlestickDiagram from "../components/CandlestickDiagram";
import VolumeConceptDiagram from "../components/VolumeConceptDiagram";
import ScaleDiagram from "../components/ScaleDiagram";
import TimeframeCompareDiagram from "../components/TimeframeCompareDiagram";
import FactorBreakdownDiagram from "../components/FactorBreakdownDiagram";
import LongShortDiagram from "../components/LongShortDiagram";
import LeverageDiagram from "../components/LeverageDiagram";
import ChartTypeGallery from "../components/ChartTypeGallery";
import PlatformLayoutDiagram from "../components/PlatformLayoutDiagram";
import TrendLineDiagram from "../components/TrendLineDiagram";
import FibonacciDiagram from "../components/FibonacciDiagram";
import TrendStructureDiagram from "../components/TrendStructureDiagram";
import SupportResistanceDiagram from "../components/SupportResistanceDiagram";
import PositionSizeCalculator from "../components/PositionSizeCalculator";
import VolatilityCompareDiagram from "../components/VolatilityCompareDiagram";
import CompareTable from "../components/CompareTable";
import GuideStepper, { getGuideStepsCompleted } from "../components/GuideStepper";
import { allStudyEntries, CATEGORY_BLURB, CATEGORY_LABEL } from "../lib/studyContent";
import type { Bias, StudyCategory, StudyEntry } from "../lib/studyContent";
import { FUNDAMENTAL_TOPICS, CHART_TOPICS, GUIDES } from "../lib/tradingBasicsContent";
import type { FundamentalId, FundamentalTopic, GuideId } from "../lib/tradingBasicsContent";
import { COURSE_TOPICS, COURSE_GROUP_LABEL } from "../lib/courseContent";
import { bonncoColors, monoStack } from "../theme/theme";

const PATTERN_CATEGORIES: StudyCategory[] = ["reversal", "continuation", "candlestick", "volume", "signals", "indicator"];

type TopGroup = "fundamentals" | "charts" | "guides" | "patterns" | "course";

const GROUP_LABEL: Record<TopGroup, string> = {
  fundamentals: "Fundamentals",
  charts: "Charts & Platforms",
  guides: "Step-by-Step Guides",
  patterns: "Chart Patterns & Indicators",
  course: COURSE_GROUP_LABEL,
};

const BIAS_COLOR: Record<Bias, string> = {
  bullish: bonncoColors.bullish,
  bearish: bonncoColors.bearish,
  neutral: bonncoColors.accent,
};

const BIAS_LABEL: Record<Bias, string> = {
  bullish: "Bullish",
  bearish: "Bearish",
  neutral: "Neutral",
};

function StudyDiagram({ entry }: { entry: StudyEntry }) {
  if (entry.kind === "candles") {
    return <CandlestickDiagram candles={entry.candles} referenceLines={entry.referenceLines} />;
  }
  if (entry.kind === "volume") {
    return <VolumeConceptDiagram pricePoints={entry.pricePoints} bars={entry.bars} />;
  }
  if (entry.kind === "scale") {
    return <ScaleDiagram zones={entry.zones} min={entry.scaleMin} max={entry.scaleMax} marker={entry.marker} markerLabel={entry.markerLabel} />;
  }
  if (entry.kind === "compare") {
    return <TimeframeCompareDiagram top={entry.top} bottom={entry.bottom} />;
  }
  if (entry.kind === "factors") {
    return <FactorBreakdownDiagram factors={entry.factors} />;
  }
  return <PatternDiagram points={entry.points} bias={entry.bias} referenceLines={entry.referenceLines} secondaryPoints={entry.secondaryPoints} band={entry.band} />;
}

function StudyCard({ entry }: { entry: StudyEntry }) {
  const color = BIAS_COLOR[entry.bias];
  return (
    <Card sx={{ p: 2, borderRadius: 1.5 }}>
      <StudyDiagram entry={entry} />

      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mt: 1.5, mb: 0.75, gap: 1 }}>
        <Typography fontWeight={700}>{entry.name}</Typography>
        <Chip
          label={BIAS_LABEL[entry.bias]}
          size="small"
          sx={{ backgroundColor: `${color}22`, color, fontWeight: 700, fontSize: 11 }}
        />
      </Stack>

      <Typography variant="body2" sx={{ mb: 1.25, lineHeight: 1.5 }}>
        {entry.summary}
      </Typography>

      <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary, display: "block", mb: 0.5 }}>
        HOW TO SPOT IT
      </Typography>
      <Stack component="ul" sx={{ m: 0, mb: 1.25, pl: 2.25, gap: 0.35 }}>
        {entry.howToSpot.map((line, i) => (
          <Typography key={i} component="li" variant="body2" sx={{ lineHeight: 1.5 }}>
            {line}
          </Typography>
        ))}
      </Stack>

      <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary, display: "block", mb: 0.5 }}>
        WHAT IT MEANS
      </Typography>
      <Typography variant="body2" sx={{ mb: 1.25, lineHeight: 1.55 }}>
        {entry.meaning}
      </Typography>

      <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.accent, display: "block", mb: 0.5 }}>
        HOW TRADERS TYPICALLY ACT ON IT
      </Typography>
      <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
        {entry.whatToDo}
      </Typography>
    </Card>
  );
}

function KeyTakeaways({ items }: { items: string[] }) {
  return (
    <Box sx={{ borderRadius: 1.5, borderLeft: `3px solid ${bonncoColors.accent}`, backgroundColor: `${bonncoColors.accent}0d`, p: 2 }}>
      <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.08em", color: bonncoColors.accent, display: "block", mb: 1 }}>
        KEY TAKEAWAYS
      </Typography>
      <Stack sx={{ gap: 0.75 }}>
        {items.map((line, i) => (
          <Stack key={i} direction="row" sx={{ gap: 0.75 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 17, color: bonncoColors.accent, flexShrink: 0, mt: 0.15 }} />
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {line}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function OnThisPageRail({ topic }: { topic: FundamentalTopic }) {
  return (
    <Box sx={{ display: { xs: "none", lg: "block" }, width: 200, flexShrink: 0, position: "sticky", top: 96 }}>
      <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.08em", color: bonncoColors.textSecondary, display: "block", mb: 1 }}>
        ON THIS PAGE
      </Typography>
      <Stack sx={{ gap: 0.1, borderLeft: `1px solid ${bonncoColors.border}` }}>
        {topic.sections.map((section) => (
          <Typography
            key={section.heading}
            component="a"
            href={`#${slugify(section.heading)}`}
            variant="body2"
            sx={{
              display: "block",
              textDecoration: "none",
              color: bonncoColors.textSecondary,
              pl: 1.5,
              py: 0.5,
              lineHeight: 1.4,
              borderLeft: `2px solid transparent`,
              ml: "-1px",
              "&:hover": { color: bonncoColors.accent, borderLeft: `2px solid ${bonncoColors.accent}` },
            }}
          >
            {section.heading}
          </Typography>
        ))}
        <Typography
          component="a"
          href="#key-takeaways"
          variant="body2"
          sx={{
            display: "block",
            textDecoration: "none",
            color: bonncoColors.accent,
            fontWeight: 600,
            pl: 1.5,
            py: 0.5,
            lineHeight: 1.4,
            borderLeft: `2px solid transparent`,
            ml: "-1px",
            "&:hover": { borderLeft: `2px solid ${bonncoColors.accent}` },
          }}
        >
          Key Takeaways
        </Typography>
      </Stack>
    </Box>
  );
}

function Breadcrumb({ group, title }: { group: string; title: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 0.6, mb: 1.5 }}>
      <Typography variant="caption" sx={{ color: bonncoColors.textSecondary, fontSize: 12.5 }}>
        {group}
      </Typography>
      <Typography variant="caption" sx={{ color: bonncoColors.textSecondary, fontSize: 12.5 }}>
        /
      </Typography>
      <Typography variant="caption" sx={{ color: bonncoColors.textSecondary, fontSize: 12.5 }}>
        {title}
      </Typography>
    </Stack>
  );
}

function FundamentalView({ topics, id, groupLabel }: { topics: FundamentalTopic[]; id: FundamentalId; groupLabel: string }) {
  const topic = topics.find((t) => t.id === id);
  if (!topic) return null;

  return (
    <Stack direction="row" sx={{ gap: 5, alignItems: "flex-start" }}>
      <Box sx={{ maxWidth: 680, width: "100%" }}>
        <Breadcrumb group={groupLabel} title={topic.title} />
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.6 }}>
          {topic.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.55 }}>
          {topic.tagline}
        </Typography>

        {topic.visual === "long-short" && (
          <Box sx={{ mb: 3 }}>
            <LongShortDiagram />
          </Box>
        )}
        {topic.visual === "leverage" && (
          <Box sx={{ mb: 3 }}>
            <LeverageDiagram />
          </Box>
        )}
        {topic.compareTable && (
          <Box sx={{ mb: 3, overflowX: "auto" }}>
            <CompareTable columns={topic.compareTable.columns} rows={topic.compareTable.rows} />
          </Box>
        )}
        {topic.scale && (
          <Box sx={{ mb: 3 }}>
            <ScaleDiagram zones={topic.scale.zones} min={topic.scale.min} max={topic.scale.max} marker={topic.scale.marker} markerLabel={topic.scale.markerLabel} />
          </Box>
        )}
        {topic.visual === "chart-gallery" && topic.candles && (
          <Box sx={{ mb: 3 }}>
            <ChartTypeGallery candles={topic.candles} />
          </Box>
        )}
        {topic.visual === "candle-anatomy" && topic.candles && (
          <Box sx={{ mb: 3 }}>
            <CandlestickDiagram candles={topic.candles} height={160} />
          </Box>
        )}
        {(topic.visual === "platform-layout" || topic.visual === "platform-layout-futures") && (
          <Box sx={{ mb: 3 }}>
            <PlatformLayoutDiagram futures={topic.visual === "platform-layout-futures"} />
          </Box>
        )}
        {(topic.visual === "trend-line" || topic.visual2 === "trend-line") && (
          <Box sx={{ mb: 3 }}>
            <TrendLineDiagram />
          </Box>
        )}
        {(topic.visual === "fibonacci" || topic.visual2 === "fibonacci") && (
          <Box sx={{ mb: 3 }}>
            <FibonacciDiagram />
          </Box>
        )}
        {(topic.visual === "trend-structure" || topic.visual2 === "trend-structure") && (
          <Box sx={{ mb: 3 }}>
            <TrendStructureDiagram />
          </Box>
        )}
        {(topic.visual === "support-resistance" || topic.visual2 === "support-resistance") && (
          <Box sx={{ mb: 3 }}>
            <SupportResistanceDiagram />
          </Box>
        )}
        {(topic.visual === "position-calculator" || topic.visual2 === "position-calculator") && (
          <Box sx={{ mb: 3 }}>
            <PositionSizeCalculator />
          </Box>
        )}
        {(topic.visual === "volatility-compare" || topic.visual2 === "volatility-compare") && (
          <Box sx={{ mb: 3 }}>
            <VolatilityCompareDiagram />
          </Box>
        )}

        <Stack sx={{ gap: 2.25, mb: 2.5 }}>
          {topic.sections.map((section) => (
            <Box key={section.heading} id={slugify(section.heading)} sx={{ scrollMarginTop: 96 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
                {section.heading}
              </Typography>
              {section.paragraphs && (
                <Stack sx={{ gap: 1 }}>
                  {section.paragraphs.map((p, i) => (
                    <Typography key={i} variant="body2" sx={{ lineHeight: 1.7, fontSize: 15, color: bonncoColors.textPrimary, opacity: 0.92 }}>
                      {p}
                    </Typography>
                  ))}
                </Stack>
              )}
              {section.bullets && (
                <Stack component="ul" sx={{ m: 0, mt: 1, pl: 2.25, gap: 0.4 }}>
                  {section.bullets.map((b, i) => (
                    <Typography key={i} component="li" variant="body2" sx={{ lineHeight: 1.6, fontSize: 15, color: bonncoColors.textPrimary, opacity: 0.92 }}>
                      {b}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Box>
          ))}
        </Stack>

        {topic.links && (
          <Stack sx={{ gap: 1, mb: 2.5 }}>
            {topic.links.map((link) => (
              <Box
                key={link.url}
                component="a"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: 1.5,
                  border: `1px solid ${bonncoColors.border}`,
                  backgroundColor: bonncoColors.bgElevated,
                  p: 1.5,
                  "&:hover": { borderColor: bonncoColors.accent },
                }}
              >
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 0.25 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {link.name}
                  </Typography>
                  <OpenInNewIcon sx={{ fontSize: 14, color: bonncoColors.textSecondary }} />
                </Stack>
                <Typography variant="body2" sx={{ lineHeight: 1.5, color: bonncoColors.textPrimary, opacity: 0.85 }}>
                  {link.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}

        {topic.worked && (
          <Box sx={{ mb: 2.5, borderRadius: 1.5, backgroundColor: bonncoColors.bgElevated, p: 2 }}>
            <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary, display: "block", mb: 1 }}>
              {topic.worked.title.toUpperCase()}
            </Typography>
            <Stack sx={{ gap: 0.75 }}>
              {topic.worked.lines.map((line, i) => (
                <Typography key={i} variant="body2" sx={{ fontFamily: monoStack, lineHeight: 1.6, fontSize: 13 }}>
                  {line}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        <Box id="key-takeaways" sx={{ scrollMarginTop: 96 }}>
          <KeyTakeaways items={topic.keyTakeaways} />
        </Box>
      </Box>

      <OnThisPageRail topic={topic} />
    </Stack>
  );
}

function GuideView({ id }: { id: GuideId }) {
  const guide = GUIDES.find((g) => g.id === id);
  if (!guide) return null;

  return (
    <Box sx={{ maxWidth: 680 }}>
      <Breadcrumb group={GROUP_LABEL.guides} title={guide.title} />
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.6 }}>
        {guide.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, lineHeight: 1.55 }}>
        {guide.tagline}
      </Typography>
      <Chip
        label={guide.audience}
        size="small"
        sx={{ mb: 2.5, backgroundColor: bonncoColors.bgElevated, color: bonncoColors.textSecondary, fontWeight: 600 }}
      />
      <GuideStepper guide={guide} />
    </Box>
  );
}

const SIDEBAR_WIDTH = 240;

function SidebarItem({ label, active, onClick, statusDot }: { label: string; active: boolean; onClick: () => void; statusDot?: string }) {
  return (
    <Stack
      direction="row"
      onClick={onClick}
      sx={{
        alignItems: "center",
        gap: 0.75,
        pl: 1,
        pr: 0.5,
        py: 0.45,
        cursor: "pointer",
        color: active ? bonncoColors.textPrimary : bonncoColors.textSecondary,
        "&:hover": { color: bonncoColors.textPrimary },
      }}
    >
      <Typography variant="body2" sx={{ fontSize: 13.5, fontWeight: active ? 700 : 400, lineHeight: 1.4, flexGrow: 1 }}>
        {label}
      </Typography>
      {statusDot && <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusDot, flexShrink: 0 }} />}
    </Stack>
  );
}

function SidebarSection({
  group,
  active,
  expanded,
  onOpen,
  isLast,
  count,
  children,
}: {
  group: TopGroup;
  active: boolean;
  expanded: boolean;
  onOpen: () => void;
  isLast?: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ pb: expanded ? 1 : 0.25, mb: expanded ? 1 : 0.25, borderBottom: isLast ? "none" : `1px solid ${bonncoColors.border}` }}>
      <Stack
        direction="row"
        onClick={onOpen}
        sx={{
          alignItems: "center",
          gap: 0.5,
          cursor: "pointer",
          pl: 1,
          pr: 0.5,
          py: 0.6,
          color: active ? bonncoColors.textPrimary : bonncoColors.textSecondary,
          "&:hover": { color: bonncoColors.textPrimary },
        }}
      >
        <ExpandMoreIcon sx={{ fontSize: 16, transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 120ms ease", flexShrink: 0 }} />
        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11.5, letterSpacing: "0.03em", flexGrow: 1 }}>
          {GROUP_LABEL[group]}
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: monoStack, fontSize: 10.5, color: bonncoColors.textSecondary }}>
          {count}
        </Typography>
      </Stack>
      {expanded && <Stack sx={{ gap: 0 }}>{children}</Stack>}
    </Box>
  );
}

function StudySidebar({
  topGroup,
  fundamentalId,
  chartTopicId,
  guideId,
  category,
  courseId,
  onSwitchGroup,
  onSelect,
}: {
  topGroup: TopGroup;
  fundamentalId: FundamentalId;
  chartTopicId: FundamentalId;
  guideId: GuideId;
  category: StudyCategory | "all";
  courseId: FundamentalId;
  onSwitchGroup: (group: TopGroup) => void;
  onSelect: <T extends string>(group: TopGroup, id: T) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);

  const courseItems = COURSE_TOPICS.map((t) => ({ id: t.id, label: t.title }));
  const fundamentalItems = FUNDAMENTAL_TOPICS.map((t) => ({ id: t.id, label: t.title }));
  const chartItems = CHART_TOPICS.map((t) => ({ id: t.id, label: t.title }));
  const guideItems = GUIDES.map((g) => ({
    id: g.id,
    label: g.title,
    dot: (() => {
      const done = getGuideStepsCompleted(g.id);
      return done === 0 ? undefined : done >= g.steps.length ? bonncoColors.bullish : bonncoColors.accent;
    })(),
  }));
  const patternItems = [{ id: "all" as const, label: "All" }, ...PATTERN_CATEGORIES.map((c) => ({ id: c, label: CATEGORY_LABEL[c] }))];

  const courseMatches = courseItems.filter((i) => matches(i.label));
  const fundamentalMatches = fundamentalItems.filter((i) => matches(i.label));
  const chartMatches = chartItems.filter((i) => matches(i.label));
  const guideMatches = guideItems.filter((i) => matches(i.label));
  const patternMatches = patternItems.filter((i) => matches(i.label));

  return (
    <Box
      sx={{
        display: { xs: "none", md: "block" },
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        position: "sticky",
        top: 88,
        maxHeight: "calc(100vh - 104px)",
        overflowY: "auto",
        borderRight: `1px solid ${bonncoColors.border}`,
        pr: 1.5,
        py: 0.5,
      }}
    >
      <TextField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a topic..."
        size="small"
        fullWidth
        sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { backgroundColor: bonncoColors.bgElevated, fontSize: 13.5 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 17, color: bonncoColors.textSecondary }} />
              </InputAdornment>
            ),
          },
        }}
      />

      <SidebarSection group="course" active={topGroup === "course"} expanded={topGroup === "course" || (q !== "" && courseMatches.length > 0)} onOpen={() => onSwitchGroup("course")} count={courseItems.length}>
        {(q ? courseMatches : courseItems).map((t) => (
          <SidebarItem key={t.id} label={t.label} active={topGroup === "course" && courseId === t.id} onClick={() => onSelect("course", t.id)} />
        ))}
      </SidebarSection>

      <SidebarSection group="fundamentals" active={topGroup === "fundamentals"} expanded={topGroup === "fundamentals" || (q !== "" && fundamentalMatches.length > 0)} onOpen={() => onSwitchGroup("fundamentals")} count={fundamentalItems.length}>
        {(q ? fundamentalMatches : fundamentalItems).map((t) => (
          <SidebarItem key={t.id} label={t.label} active={topGroup === "fundamentals" && fundamentalId === t.id} onClick={() => onSelect("fundamentals", t.id)} />
        ))}
      </SidebarSection>

      <SidebarSection group="charts" active={topGroup === "charts"} expanded={topGroup === "charts" || (q !== "" && chartMatches.length > 0)} onOpen={() => onSwitchGroup("charts")} count={chartItems.length}>
        {(q ? chartMatches : chartItems).map((t) => (
          <SidebarItem key={t.id} label={t.label} active={topGroup === "charts" && chartTopicId === t.id} onClick={() => onSelect("charts", t.id)} />
        ))}
      </SidebarSection>

      <SidebarSection group="guides" active={topGroup === "guides"} expanded={topGroup === "guides" || (q !== "" && guideMatches.length > 0)} onOpen={() => onSwitchGroup("guides")} count={guideItems.length}>
        {(q ? guideMatches : guideItems).map((g) => (
          <SidebarItem
            key={g.id}
            label={g.label}
            active={topGroup === "guides" && guideId === g.id}
            onClick={() => onSelect("guides", g.id)}
            statusDot={g.dot}
          />
        ))}
      </SidebarSection>

      <SidebarSection group="patterns" active={topGroup === "patterns"} expanded={topGroup === "patterns" || (q !== "" && patternMatches.length > 0)} onOpen={() => onSwitchGroup("patterns")} count={patternItems.length} isLast>
        {(q ? patternMatches : patternItems).map((c) => (
          <SidebarItem key={c.id} label={c.label} active={topGroup === "patterns" && category === c.id} onClick={() => onSelect("patterns", c.id)} />
        ))}
      </SidebarSection>
    </Box>
  );
}

export default function StudyPage() {
  const [searchParams] = useSearchParams();
  const guideParam = searchParams.get("guide");
  const linkedGuide = guideParam ? GUIDES.find((g) => g.id === guideParam) : undefined;

  const [topGroup, setTopGroup] = useState<TopGroup>(linkedGuide ? "guides" : "fundamentals");
  const [fundamentalId, setFundamentalId] = useState<FundamentalId>(FUNDAMENTAL_TOPICS[0].id);
  const [chartTopicId, setChartTopicId] = useState<FundamentalId>(CHART_TOPICS[0].id);
  const [guideId, setGuideId] = useState<GuideId>(linkedGuide ? linkedGuide.id : GUIDES[0].id);
  const [category, setCategory] = useState<StudyCategory | "all">("all");
  const [courseId, setCourseId] = useState<FundamentalId>(COURSE_TOPICS[0].id);

  const entries = useMemo(() => allStudyEntries(), []);

  const grouped = useMemo(() => {
    const cats = category === "all" ? PATTERN_CATEGORIES : [category];
    return cats.map((cat) => ({ category: cat, items: entries.filter((e) => e.category === cat) }));
  }, [entries, category]);

  function handleSelect<T extends string>(group: TopGroup, id: T) {
    setTopGroup(group);
    if (group === "fundamentals") setFundamentalId(id as FundamentalId);
    if (group === "charts") setChartTopicId(id as FundamentalId);
    if (group === "guides") setGuideId(id as GuideId);
    if (group === "patterns") setCategory(id as StudyCategory | "all");
    if (group === "course") setCourseId(id as FundamentalId);
  }

  const bannerText =
    topGroup === "patterns"
      ? "Every chart in this section is an illustrative reference diagram, not live market data. For real-time signals, use the Dashboard or a coin's own page."
      : "This section is educational reference material, not financial advice, and never guarantees a profit outcome. You always decide and place your own trades.";

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5 }}>
        <SchoolOutlinedIcon sx={{ color: bonncoColors.accent }} />
        <Typography variant="h5" fontWeight={700}>
          Study
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Everything from your first spot trade to exactly how Bonnco's own signal engine reads each indicator, in plain
        words.
      </Typography>

      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          gap: 1,
          mb: 3,
          px: 2,
          py: 1.25,
          borderRadius: 1.5,
          border: `1px solid ${bonncoColors.border}`,
          backgroundColor: `${bonncoColors.neutral}0d`,
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 18, color: bonncoColors.neutral, flexShrink: 0 }} />
        <Typography variant="body2" color="text.secondary">
          {bannerText}
        </Typography>
      </Stack>

      <Stack direction="row" sx={{ gap: 3.5, alignItems: "flex-start" }}>
        <StudySidebar
          topGroup={topGroup}
          fundamentalId={fundamentalId}
          chartTopicId={chartTopicId}
          guideId={guideId}
          category={category}
          courseId={courseId}
          onSwitchGroup={setTopGroup}
          onSelect={handleSelect}
        />

        <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
          <Box sx={{ width: "100%", maxWidth: 920 }}>
            {topGroup === "course" && <FundamentalView topics={COURSE_TOPICS} id={courseId} groupLabel={COURSE_GROUP_LABEL} />}

            {topGroup === "fundamentals" && <FundamentalView topics={FUNDAMENTAL_TOPICS} id={fundamentalId} groupLabel={GROUP_LABEL.fundamentals} />}

            {topGroup === "charts" && <FundamentalView topics={CHART_TOPICS} id={chartTopicId} groupLabel={GROUP_LABEL.charts} />}

            {topGroup === "guides" && <GuideView id={guideId} />}

            {topGroup === "patterns" && (
              <Box>
                <Box sx={{ borderRadius: 1.5, borderLeft: `3px solid ${bonncoColors.accent}`, backgroundColor: `${bonncoColors.accent}0d`, p: 2, mb: 4 }}>
                  <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.08em", color: bonncoColors.accent, display: "block", mb: 1 }}>
                    HOW BONNCO ACTUALLY USES THIS LIBRARY
                  </Typography>
                  <Stack sx={{ gap: 1 }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                      Bonnco scans every coin and timeframe you view for the patterns below automatically, you don't
                      have to spot them yourself. Each detected pattern gets a completeness score and a confirmed or
                      not-yet-confirmed flag, and when more than one pattern is forming at once, Bonnco picks a single
                      headline pattern (the most complete one), only mentioning a second if it's genuinely close.
                    </Typography>
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                      A detected pattern nudges the signal's confidence slightly, scaled by how complete and confirmed
                      it is, it never decides a BUY/SELL/HOLD call on its own. Bonnco also tracks what actually happened
                      after each pattern historically for that coin (hit, miss, or still pending), ask Bonnco about a
                      coin's pattern history and it can cite those real past outcomes, not just the textbook description
                      below.
                    </Typography>
                  </Stack>
                </Box>

                {grouped.map(({ category: cat, items }) => (
                  <Box key={cat} sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.25 }}>
                      {CATEGORY_LABEL[cat]}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {CATEGORY_BLURB[cat]}
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
                      {items.map((entry) => (
                        <StudyCard key={entry.id} entry={entry} />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}
