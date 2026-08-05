import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/theme-provider";
import "./global.css";
import Home from "./pages/home";
import Login from "./pages/login";
import ProtectedRoute from "./components/protected-route";
import SSOCallback from "./components/sso-callback";
import Verify from "./pages/verify";
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

export default function App() {
  return (
    <HelmetProvider>
      <DailifyProvider>
        <Router>
          <ThemeProvider defaultTheme="dark">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<LandingPage />} />

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
                  path="/login"
                  element={
                    <>
                      <Helmet>
                        <title>Dailify - Login</title>
                      </Helmet>

                      <Login />
                    </>
                  }
                />

                <Route path="/login/sso-callback" element={<SSOCallback />} />

                <Route path="/sign-in/verify" element={<Verify />} />

                <Route path="/task/:id" element={<TaskPreview />} />

                <Route path="/premium" element={<PremiumPage />} />

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
