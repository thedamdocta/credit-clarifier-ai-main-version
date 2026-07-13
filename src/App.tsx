import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import { ReportWorkspaceProvider } from "@/features/workspace/ReportWorkspaceContext";
import AcquireReportsPage from "@/pages/AcquireReportsPage";
import DisputePage from "@/pages/DisputePage";
import NotFound from "@/pages/NotFound";
import ReportPage from "@/pages/ReportPage";
import SettingsPage from "@/pages/SettingsPage";
import UploadPage from "@/pages/UploadPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ReportWorkspaceProvider>
          <Routes>
            <Route path="/" element={<Layout><UploadPage /></Layout>} />
            <Route path="/upload" element={<Layout><UploadPage /></Layout>} />
            <Route path="/acquire" element={<Layout><AcquireReportsPage /></Layout>} />
            <Route path="/report" element={<Layout><ReportPage /></Layout>} />
            <Route path="/dispute" element={<Layout><DisputePage /></Layout>} />
            <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />

            <Route path="/reports" element={<Navigate to="/report" replace />} />
            <Route path="/reports/upload" element={<Navigate to="/upload" replace />} />
            <Route path="/reports/view" element={<Navigate to="/report" replace />} />
            <Route path="/reports/dispute" element={<Navigate to="/dispute" replace />} />
            <Route
              path="/webhooks"
              element={<Navigate to={{ pathname: "/settings", search: "?section=integrations" }} replace />}
            />
            <Route
              path="/developer"
              element={<Navigate to={{ pathname: "/settings", search: "?section=developer" }} replace />}
            />
            <Route
              path="/debugger"
              element={<Navigate to={{ pathname: "/settings", search: "?section=diagnostics" }} replace />}
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </ReportWorkspaceProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
