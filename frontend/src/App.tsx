import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { RiskProfileProvider } from "./contexts/RiskProfileContext";
import { AlertsProvider } from "./contexts/AlertsContext";
import DashboardPage from "./pages/DashboardPage";
import WatchlistPage from "./pages/WatchlistPage";
import CoinDetailPage from "./pages/CoinDetailPage";
import ChatPage from "./pages/ChatPage";
import TradeJournalPage from "./pages/TradeJournalPage";
import PerformancePage from "./pages/PerformancePage";
import SettingsPage from "./pages/SettingsPage";
import NewsFeedPage from "./pages/NewsFeedPage";
import StudyPage from "./pages/StudyPage";
import WhaleActivityPage from "./pages/WhaleActivityPage";

export default function App() {
  return (
    <Routes>
      <Route
        element={
          <RiskProfileProvider>
            <AlertsProvider>
              <AppLayout />
            </AlertsProvider>
          </RiskProfileProvider>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="coin/:symbol" element={<CoinDetailPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="journal" element={<TradeJournalPage />} />
        <Route path="performance" element={<PerformancePage />} />
        {/* Portfolio's content merged into Dashboard ("/") — redirect any old bookmark/link. */}
        <Route path="portfolio" element={<Navigate to="/" replace />} />
        <Route path="news" element={<NewsFeedPage />} />
        <Route path="whales" element={<WhaleActivityPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
