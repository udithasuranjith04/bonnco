import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchSettings, updateSettings } from "../api/client";
import type { RiskProfile } from "../api/client";

interface RiskProfileContextValue {
  riskProfile: RiskProfile;
  setRiskProfile: (value: RiskProfile) => Promise<void>;
}

const RiskProfileContext = createContext<RiskProfileContextValue | null>(null);

export function RiskProfileProvider({ children }: { children: React.ReactNode }) {
  const [riskProfile, setRiskProfileState] = useState<RiskProfile>("moderate");

  useEffect(() => {
    fetchSettings().then((s) => setRiskProfileState(s.risk_profile));
  }, []);

  // Single source of truth for risk profile — both the top-bar selector and the Settings page
  // read/write through here, so changing it in either place updates the other (and the ambient
  // border) immediately instead of only after a page reload.
  const setRiskProfile = useCallback(async (value: RiskProfile) => {
    setRiskProfileState(value);
    await updateSettings({ risk_profile: value });
  }, []);

  return <RiskProfileContext.Provider value={{ riskProfile, setRiskProfile }}>{children}</RiskProfileContext.Provider>;
}

export function useRiskProfile(): RiskProfileContextValue {
  const ctx = useContext(RiskProfileContext);
  if (!ctx) throw new Error("useRiskProfile must be used within a RiskProfileProvider");
  return ctx;
}
