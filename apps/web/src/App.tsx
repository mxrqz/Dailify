import { MotionConfig } from "motion/react";
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Navigate, Outlet, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import "./global.css";
import Home from "@/pages/home";
import ProtectedRoute from "@/components/protected-route";
import { DailifyProvider } from "@/components/dailifyContext";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppLayout } from "@/components/app-layout";
import { Refraction } from "@/components/kit/refraction";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { isTauri } from "@/lib/platform";

// Só o dashboard (start_url do PWA) vai no bundle de entrada; o resto baixa quando a rota abre.
const LandingPage = lazy(() => import("@/pages/landingPage"));
const Login = lazy(() => import("@/pages/login"));
const SignUp = lazy(() => import("@/pages/signup"));
const Verify = lazy(() => import("@/pages/verify"));
const AuthApp = lazy(() => import("@/pages/auth-app"));
const AppReturn = lazy(() => import("@/pages/app-return"));
const BillingPage = lazy(() => import("@/pages/billing"));
const PremiumPage = lazy(() => import("@/pages/premium"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const SecurityPage = lazy(() => import("@/pages/security"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const IntegrationsPage = lazy(() => import("@/pages/integrations"));
const IntegrationCallback = lazy(() => import("@/pages/integration-callback"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const TermsPage = lazy(() => import("@/pages/terms"));

export default function App() {
  return (
    <HelmetProvider>
      <DailifyProvider>
        <Router>
          <ThemeProvider>
            <TooltipProvider>
              <MotionConfig reducedMotion="user">
                <ErrorBoundary>
                  {/* Fallback vazio: o body já é bg-canvas. O router navega em transição, então só
                      a primeira carga de uma rota cai aqui; trocar de rota mantém a tela atual. */}
                  <Suspense fallback={null}>
                    <Routes>
                      {/* The app has no landing: "/" is its start URL and every in-app link to it. */}
                      <Route
                        path="/"
                        element={isTauri() ? <Navigate to="/dashboard" replace /> : <LandingPage />}
                      />

                      {/* Tudo que é "o app" divide a mesma top bar (components/app-layout.tsx). */}
                      <Route element={<AppLayout />}>
                        <Route
                          element={
                            <ProtectedRoute>
                              <Outlet />
                            </ProtectedRoute>
                          }
                        >
                          <Route path="/dashboard" element={<Home />} />
                          <Route path="/profile" element={<ProfilePage />} />
                          <Route path="/settings" element={<SettingsPage />} />
                          <Route path="/security" element={<SecurityPage />} />
                          <Route path="/billing" element={<BillingPage />} />
                          <Route path="/integrations" element={<IntegrationsPage />} />
                          {/* redirect_uri do OAuth: o servidor só aceita o code com o bearer de quem pediu. */}
                          <Route
                            path="/integrations/:provider/callback"
                            element={<IntegrationCallback />}
                          />
                        </Route>

                        <Route path="/premium" element={<PremiumPage />} />
                      </Route>

                      <Route path="/login" element={<Login />} />

                      <Route path="/signup" element={<SignUp />} />

                      <Route path="/verify" element={<Verify />} />

                      <Route path="/auth/app" element={<AuthApp />} />

                      <Route path="/app/*" element={<AppReturn />} />

                      <Route path="/privacidade" element={<PrivacyPage />} />

                      <Route path="/termos" element={<TermsPage />} />

                      {/* Sem isto, path inexistente renderiza tela branca — já custou o bug /prices. */}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>

                <ScrollRestoration />
                <Toaster />
                <Refraction />
              </MotionConfig>
            </TooltipProvider>
          </ThemeProvider>
        </Router>
      </DailifyProvider>
    </HelmetProvider>
  );
}
