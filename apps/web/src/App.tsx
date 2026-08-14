import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/theme-provider";
import "./global.css";
import Home from "./pages/home";
import Login from "./pages/login";
import SignUp from "./pages/signup";
import ProtectedRoute from "./components/protected-route";
import Verify from "./pages/verify";
import { copy } from "@/components/auth/copy";
import { DailifyProvider } from "./components/dailifyContext";
import ProfilePage from "./pages/profile";
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
          <ThemeProvider defaultTheme="dark">
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

                <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />

                <Route path="/verify" element={<Verify />} />

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
