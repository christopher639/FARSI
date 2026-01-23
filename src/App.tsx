import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import ThreatHeatmapPage from "./pages/ThreatHeatmapPage";
import AlertsPage from "./pages/AlertsPage";
import NetworkAnalysisPage from "./pages/NetworkAnalysisPage";
import SurveillancePage from "./pages/SurveillancePage";
import IntelligenceReportsPage from "./pages/IntelligenceReportsPage";
import CommunicationsPage from "./pages/CommunicationsPage";
import DataFusionPage from "./pages/DataFusionPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";
import NotFound from "./pages/NotFound";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/threat-heatmap" element={<ThreatHeatmapPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/network-analysis" element={<NetworkAnalysisPage />} />
                <Route path="/surveillance" element={<SurveillancePage />} />
                <Route path="/intelligence-reports" element={<IntelligenceReportsPage />} />
                <Route path="/communications" element={<CommunicationsPage />} />
                <Route path="/data-fusion" element={<DataFusionPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
