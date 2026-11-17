import { MotionConfig } from "motion/react";
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/theme-provider";
import "./global.css";
import Home from "./pages/home";
import ProtectedRoute from "./components/protected-route";
import { copy } from "@/components/auth/copy";
import { DailifyProvider } from "./components/dailifyContext";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "./components/error-boundary";
import { AppLayout } from "./components/app-layout";
import { Refraction } from "@/components/kit/refraction";

// Só o dashboard (start_url do PWA) vai no bundle de entrada; o resto baixa quando a rota abre.
const LandingPage = lazy(() => import("./pages/landingPage"));
const Login = lazy(() => import("./pages/login"));
const SignUp = lazy(() => import("./pages/signup"));
const Verify = lazy(() => import("./pages/verify"));
const AuthApp = lazy(() => import("./pages/auth-app"));
const BillingPage = lazy(() => import("./pages/billing"));
const PremiumPage = lazy(() => import("./pages/premium"));
const ProfilePage = lazy(() => import("./pages/profile"));
const SecurityPage = lazy(() => import("./pages/security"));
const SettingsPage = lazy(() => import("./pages/settings"));
const IntegrationsPage = lazy(() => import("./pages/integrations"));
const IntegrationCallback = lazy(() => import("./pages/integration-callback"));
const TaskPreview = lazy(() => import("./pages/[id]/taskPreview"));
const PrivacyPage = lazy(() => import("./pages/privacy"));
const TermsPage = lazy(() => import("./pages/terms"));

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
                      <Route path="/" element={<LandingPage />} />

                      {/* Tudo que é "o app" divide a mesma top bar (components/app-layout.tsx). */}
                      <Route element={<AppLayout />}>
                        <Route
                          path="/dashboard"
                          element={
                            <ProtectedRoute>
                              <Helmet>
                                <title>Mewki - Dashboard</title>
                              </Helmet>

                              <Home />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/profile"
                          element={
                            <ProtectedRoute>
                              <Helmet>
                                <title>Mewki - Profile</title>
                              </Helmet>

                              <ProfilePage />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/settings"
                          element={
                            <ProtectedRoute>
                              <Helmet>
                                <title>Mewki - Configurações</title>
                              </Helmet>

                              <SettingsPage />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/security"
                          element={
                            <ProtectedRoute>
                              <Helmet>
                                <title>Mewki - Segurança</title>
                              </Helmet>

                              <SecurityPage />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/billing"
                          element={
                            <ProtectedRoute>
                              <Helmet>
                                <title>Mewki - Premium</title>
                              </Helmet>

                              <BillingPage />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/integrations"
                          element={
                            <ProtectedRoute>
                              <Helmet>
                                <title>Mewki - Integrações</title>
                              </Helmet>

                              <IntegrationsPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* redirect_uri do OAuth: o servidor só aceita o code com o bearer de quem pediu. */}
                        <Route
                          path="/integrations/:provider/callback"
                          element={
                            <ProtectedRoute>
                              <IntegrationCallback />
                            </ProtectedRoute>
                          }
                        />

                        <Route path="/premium" element={<PremiumPage />} />
                      </Route>

                      <Route
                        path="/login"
                        element={
                          <>
                            <Helmet>
                              <title>{copy.signIn.pageTitle}</title>
                            </Helmet>

                            <Login />
                          </>
                        }
                      />

                      <Route
                        path="/signup"
                        element={
                          <>
                            <Helmet>
                              <title>{copy.signUp.pageTitle}</title>
                            </Helmet>

                            <SignUp />
                          </>
                        }
                      />

                      <Route
                        path="/verify"
                        element={
                          <>
                            <Helmet>
                              <title>{copy.verify.pageTitle}</title>
                            </Helmet>

                            <Verify />
                          </>
                        }
                      />

                      <Route path="/auth/app" element={<AuthApp />} />

                      <Route path="/task/:id" element={<TaskPreview />} />

                      <Route path="/privacidade" element={<PrivacyPage />} />

                      <Route path="/termos" element={<TermsPage />} />

                      {/* Sem isto, path inexistente renderiza tela branca — já custou o bug /prices. */}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>

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
