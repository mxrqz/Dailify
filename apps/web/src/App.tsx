import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { Loader2Icon } from "lucide-react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthShell } from "@/components/auth/auth-shell";
import { ThemeProvider } from "./components/theme-provider";
import "./global.css";
import Home from "./pages/home";
import Login from "./pages/login";
import SignUp from "./pages/signup";
import ProtectedRoute from "./components/protected-route";
import Verify from "./pages/verify";
import { copy } from "@/components/auth/copy";
import { DailifyProvider } from "./components/dailifyContext";
import BillingPage from "./pages/billing";
import ProfilePage from "./pages/profile";
import SecurityPage from "./pages/security";
import SettingsPage from "./pages/settings";
import { Helmet, HelmetProvider } from "react-helmet-async";
import TaskPreview from "./pages/[id]/taskPreview";
import LandingPage from "./pages/landingPage";
import PremiumPage from "./pages/premium";
import PrivacyPage from "./pages/privacy";
import TermsPage from "./pages/terms";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "./components/error-boundary";
import { AppLayout } from "./components/app-layout";

export default function App() {
  return (
    <HelmetProvider>
      <DailifyProvider>
        <Router>
          <ThemeProvider>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<LandingPage />} />

                {/* Tudo que é "o app" divide a mesma top bar (components/app-layout.tsx). */}
                <Route element={<AppLayout />}>
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Helmet>
                          <title>Dailify - Dashboard</title>
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
                          <title>Dailify - Profile</title>
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
                          <title>Dailify - Configurações</title>
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
                          <title>Dailify - Segurança</title>
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
                          <title>Dailify - Premium</title>
                        </Helmet>

                        <BillingPage />
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

                {/* O round-trip do Google não pode ser uma página branca: a mesma casca das
                    outras telas de auth, com o spinner, enquanto o Clerk resolve. */}
                <Route
                  path="/sso-callback"
                  element={
                    <AuthShell>
                      <div className="flex justify-center">
                        <Loader2Icon className="size-6 animate-spin text-primary" />
                      </div>
                      <AuthenticateWithRedirectCallback />
                    </AuthShell>
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

                <Route path="/task/:id" element={<TaskPreview />} />

                <Route path="/privacidade" element={<PrivacyPage />} />

                <Route path="/termos" element={<TermsPage />} />
              </Routes>
            </ErrorBoundary>

            <Toaster />
          </ThemeProvider>
        </Router>
      </DailifyProvider>
    </HelmetProvider>
  );
}
