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
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <HelmetProvider>
      <DailifyProvider>
        <Router>
          <ThemeProvider>
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
            </Routes>

            <Toaster />
          </ThemeProvider>
        </Router>
      </DailifyProvider>
    </HelmetProvider>
  );
}
