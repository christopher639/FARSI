import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import ThreatHeatmapPage from "./pages/ThreatHeatmapPage";
import CrimeReportPage from "./pages/CrimeReportPage";
import AlertsPage from "./pages/AlertsPage";
import NetworkAnalysisPage from "./pages/NetworkAnalysisPage";
import SurveillancePage from "./pages/SurveillancePage";
import IntelligenceReportsPage from "./pages/IntelligenceReportsPage";
import CommunicationsPage from "./pages/CommunicationsPage";
import DataFusionPage from "./pages/DataFusionPage";
import CrimeModelPage from "./pages/CrimeModelPage";
import MLIntelligencePage from "./pages/MLIntelligencePage";
import AuditLogsPage from "./pages/AuditLogsPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";
import SystemSettingsPage from "./pages/SystemSettingsPage";
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
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            
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
                <Route path="/crime-model" element={<CrimeModelPage />} />
                <Route path="/ml-intelligence" element={<MLIntelligencePage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/system-settings" element={<SystemSettingsPage />} />
                <Route element={<ProtectedRoute requiredRoles={["admin", "analyst", "security_agent"]} />}>
                  <Route path="/crime-reports" element={<CrimeReportPage />} />
                </Route>
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
