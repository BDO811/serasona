import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AssessmentProvider } from "@/context/AssessmentContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageShell } from "@/components/PageShell";
import Index from "./pages/Index";
import DetailedAnalysisView from "./pages/DetailedAnalysisView";
import LongitudinalView from "./pages/LongitudinalView";
import Dashboard from "./pages/Dashboard";
import ApiDebugView from "./pages/ApiDebugView";
import PanelPreview from "./pages/PanelPreview";
import AnalysisFailed from "./pages/AnalysisFailed";
import RecordingNotSupported from "./pages/RecordingNotSupported";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Account from "./pages/Account";
import Checkin from "./pages/Checkin";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Science from "./pages/Science";
import Models from "./pages/Models";
import Admin from "./pages/Admin";
import CheckinByPhone from "./pages/CheckinByPhone";
import SmoothHeroDemo from "./pages/SmoothHeroDemo";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        // Matches Vite's base, so routes resolve whether the app is served from
        // a domain root or from a GitHub Pages project subpath.
        basename={import.meta.env.BASE_URL}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <AssessmentProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              {/* Login has linked here since it was written; the route never existed. */}
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <PageShell>
                      <Admin />
                    </PageShell>
                  </ProtectedRoute>
                }
              />
              <Route path="/terms" element={<PageShell><Terms /></PageShell>} />
              <Route path="/privacy" element={<PageShell><Privacy /></PageShell>} />
              <Route path="/science" element={<PageShell><Science /></PageShell>} />
              <Route path="/models" element={<PageShell><Models /></PageShell>} />
              <Route
                path="/account"
                element={
                  /* Account renders SiteHeader itself; no PageShell, or it doubles. */
                  <ProtectedRoute>
                    <Account />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/checkin"
                element={
                  <ProtectedRoute>
                    <Checkin />
                  </ProtectedRoute>
                }
              />
              {/* Plus and above. The page itself redirects to /pricing below that. */}
              <Route
                path="/checkin/phone"
                element={
                  <ProtectedRoute>
                    <PageShell>
                      <CheckinByPhone />
                    </PageShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/detailed-analysis"
                element={
                  <ProtectedRoute>
                    <DetailedAnalysisView />
                  </ProtectedRoute>
                }
              />
              <Route path="/history" element={<PageShell><LongitudinalView /></PageShell>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <PageShell>
                      <Dashboard />
                    </PageShell>
                  </ProtectedRoute>
                }
              />
              {import.meta.env.DEV && (
                <>
                  <Route path="/api-debug" element={<ApiDebugView />} />
                  <Route path="/panel-preview" element={<PanelPreview />} />
                  <Route path="/smooth-hero-demo" element={<SmoothHeroDemo />} />
                </>
              )}
              <Route path="/analysis-failed" element={<AnalysisFailed onRestart={() => window.location.href = "/"} />} />
              <Route path="/recording-not-supported" element={<RecordingNotSupported onBack={() => window.location.href = "/"} />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<PageShell><NotFound /></PageShell>} />
            </Routes>
          </AssessmentProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
