import { useEffect, useState } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import type { Guide } from "../lib/tradingBasicsContent";
import { bonncoColors, monoStack } from "../theme/theme";

const STORAGE_PREFIX = "bonnco-guide-progress-";

function loadCompleted(guideId: string): number {
  const raw = window.localStorage.getItem(STORAGE_PREFIX + guideId);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getGuideStepsCompleted(guideId: string): number {
  return loadCompleted(guideId);
}

export default function GuideStepper({ guide }: { guide: Guide }) {
  const [completedThrough, setCompletedThrough] = useState(0);
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    const done = loadCompleted(guide.id);
    setCompletedThrough(done);
    setActiveStep(Math.min(done + 1, guide.steps.length));
  }, [guide.id]);

  function markComplete(step: number) {
    const next = Math.max(completedThrough, step);
    setCompletedThrough(next);
    window.localStorage.setItem(STORAGE_PREFIX + guide.id, String(next));
    if (step < guide.steps.length) {
      setActiveStep(step + 1);
    }
  }

  function resetProgress() {
    setCompletedThrough(0);
    setActiveStep(1);
    window.localStorage.removeItem(STORAGE_PREFIX + guide.id);
  }

  const allDone = completedThrough >= guide.steps.length;

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary">
          {completedThrough} of {guide.steps.length} steps completed
        </Typography>
        {completedThrough > 0 && (
          <Button size="small" onClick={resetProgress} sx={{ color: bonncoColors.textSecondary, textTransform: "none" }}>
            Reset progress
          </Button>
        )}
      </Stack>

      {allDone && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 2,
            px: 2,
            py: 1.25,
            borderRadius: 1.5,
            border: `1px solid ${bonncoColors.bullish}55`,
            backgroundColor: `${bonncoColors.bullish}12`,
          }}
        >
          <CheckCircleIcon sx={{ color: bonncoColors.bullish, fontSize: 20 }} />
          <Typography variant="body2" fontWeight={600}>
            Guide complete. Review any step below, or reset to go through it again.
          </Typography>
        </Box>
      )}

      <Stack sx={{ gap: 1 }}>
        {guide.steps.map((s) => {
          const isCompleted = s.step <= completedThrough;
          const isLocked = s.step > completedThrough + 1;
          const isActive = s.step === activeStep && !isLocked;

          return (
            <Box
              key={s.step}
              sx={{
                borderRadius: 1.5,
                border: `1px solid ${isActive ? bonncoColors.accent + "66" : bonncoColors.border}`,
                backgroundColor: isLocked ? "transparent" : bonncoColors.bgElevated,
                opacity: isLocked ? 0.55 : 1,
                overflow: "hidden",
              }}
            >
              <Stack
                direction="row"
                onClick={() => !isLocked && setActiveStep(s.step)}
                sx={{
                  alignItems: "center",
                  gap: 1.25,
                  px: 2,
                  py: 1.25,
                  cursor: isLocked ? "default" : "pointer",
                }}
              >
                {isCompleted ? (
                  <CheckCircleIcon sx={{ color: bonncoColors.bullish, fontSize: 20, flexShrink: 0 }} />
                ) : isLocked ? (
                  <LockOutlinedIcon sx={{ color: bonncoColors.textSecondary, fontSize: 18, flexShrink: 0 }} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ color: bonncoColors.accent, fontSize: 20, flexShrink: 0 }} />
                )}
                <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary, flexShrink: 0 }}>
                  STEP {s.step}
                </Typography>
                <Typography variant="body2" fontWeight={isActive ? 700 : 600} sx={{ flexGrow: 1 }}>
                  {s.title}
                </Typography>
              </Stack>

              {isActive && (
                <Box sx={{ px: 2, pb: 2, pl: { xs: 2, sm: 5.5 } }}>
                  <Stack sx={{ gap: 1, mb: 1.5 }}>
                    {s.paragraphs.map((p, i) => (
                      <Typography key={i} variant="body2" sx={{ lineHeight: 1.65, fontSize: 15, color: bonncoColors.textPrimary, opacity: 0.92 }}>
                        {p}
                      </Typography>
                    ))}
                  </Stack>

                  {s.bullets && (
                    <Stack component="ul" sx={{ m: 0, mb: 1.5, pl: 2.25, gap: 0.4 }}>
                      {s.bullets.map((b, i) => (
                        <Typography key={i} component="li" variant="body2" sx={{ lineHeight: 1.6, fontSize: 15, color: bonncoColors.textPrimary, opacity: 0.92 }}>
                          {b}
                        </Typography>
                      ))}
                    </Stack>
                  )}

                  {s.tip && (
                    <Stack direction="row" sx={{ gap: 0.75, mb: 1.25, p: 1.25, borderRadius: 1, backgroundColor: `${bonncoColors.accent}12` }}>
                      <LightbulbOutlinedIcon sx={{ color: bonncoColors.accent, fontSize: 18, flexShrink: 0, mt: 0.1 }} />
                      <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                        {s.tip}
                      </Typography>
                    </Stack>
                  )}

                  {s.warning && (
                    <Stack direction="row" sx={{ gap: 0.75, mb: 1.25, p: 1.25, borderRadius: 1, backgroundColor: `${bonncoColors.bearish}12` }}>
                      <WarningAmberOutlinedIcon sx={{ color: bonncoColors.bearish, fontSize: 18, flexShrink: 0, mt: 0.1 }} />
                      <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                        {s.warning}
                      </Typography>
                    </Stack>
                  )}

                  {!isCompleted ? (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => markComplete(s.step)}
                      sx={{ backgroundColor: bonncoColors.accent }}
                    >
                      {s.step < guide.steps.length ? "Mark complete & continue" : "Mark complete"}
                    </Button>
                  ) : (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                      label="Completed"
                      size="small"
                      sx={{ backgroundColor: `${bonncoColors.bullish}22`, color: bonncoColors.bullish, fontWeight: 700 }}
                    />
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
