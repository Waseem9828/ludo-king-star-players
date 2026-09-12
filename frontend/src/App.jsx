import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { SWRConfig } from "swr";
import React, { Suspense, lazy, useState, useEffect } from "react";
import AppLayout from "./components/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Loading from "./components/Loading.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import { PremiumToastCard } from "./components/PremiumToast.jsx";
import { apiRequest } from "./lib/apiClient.js";
import PwaSplashScreen from "./components/PwaSplashScreen.jsx";
import PwaUpdateModal from "./components/PwaUpdateModal.jsx";

// LAZY LOAD ALL ROUTES FOR CODE SPLITTING
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const Wallet = lazy(() => import("./pages/Wallet.jsx"));
const MatchRoom = lazy(() => import("./pages/MatchRoom.jsx"));
const MatchRoomDetail = lazy(() => import("./pages/MatchRoomDetail.jsx"));
const Referral = lazy(() => import("./pages/Referral.jsx"));
const History = lazy(() => import("./pages/History.jsx"));
const Account = lazy(() => import("./pages/Account.jsx"));
const Support = lazy(() => import("./pages/Support.jsx"));
const TermsPrivacy = lazy(() => import("./pages/TermsPrivacy.jsx"));
const TermAndConditions = lazy(() => import("./pages/TermAndConditions.jsx"));
const GstPolicy = lazy(() => import("./pages/GstPolicy.jsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.jsx"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy.jsx"));
const Leaderboard = lazy(() => import("./pages/Leaderboard.jsx"));
const Notifications = lazy(() => import("./pages/Notifications.jsx"));
const PaymentMethods = lazy(() => import("./pages/PaymentMethods.jsx"));
const Kyc = lazy(() => import("./pages/Kyc.jsx"));
const PracticeLobby = lazy(() => import("./pages/practice/PracticeLobby.jsx"));
const PracticeWaitingRoom = lazy(() => import("./pages/practice/PracticeWaitingRoom.jsx"));
const PracticeGameRoom = lazy(() => import("./pages/practice/PracticeGameRoom.jsx"));

// ADMIN LAZY IMPORTS
const AdminLayout = lazy(() => import("./pages/admin/components/AdminLayout.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers.jsx"));
const AdminMatches = lazy(() => import("./pages/admin/AdminMatches.jsx"));
const AdminWithdrawals = lazy(() => import("./pages/admin/AdminWithdrawals.jsx"));
const AdminDepositHistory = lazy(() => import("./pages/admin/AdminDepositHistory.jsx"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications.jsx"));
const AdminSiteSettings = lazy(() => import("./pages/admin/AdminSiteSettings.jsx"));
const AdminSystemHealth = lazy(() => import("./pages/admin/AdminSystemHealth.jsx"));
const AdminKyc = lazy(() => import("./pages/admin/AdminKyc.jsx"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs.jsx"));
const AdminDigitalManagement = lazy(() => import("./pages/admin/AdminDigitalManagement.jsx"));
const AdminReferrals = lazy(() => import("./pages/admin/AdminReferrals.jsx"));
const AdminContacts = lazy(() => import("./pages/admin/AdminContacts.jsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.jsx"));

export default function App() {
  const { initializing, token } = useAuth();

  const [showSplash, setShowSplash] = useState(() => {
    // Show splash screen on installed PWA launch or initial app load
    const isStandalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone);
    const hasShownInSession = typeof sessionStorage !== "undefined" && sessionStorage.getItem("pwa_splash_shown");
    return Boolean(isStandalone || !hasShownInSession);
  });

  useEffect(() => {
    const handleReTrigger = () => setShowSplash(true);
    window.addEventListener("app:show_splash", handleReTrigger);
    return () => window.removeEventListener("app:show_splash", handleReTrigger);
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem("pwa_splash_shown", "true");
    setShowSplash(false);
  };

  if (initializing) {
    return <Loading fullPage label="Loading..." />;
  }

  return (
    <>
      <PwaUpdateModal />
      {showSplash && <PwaSplashScreen onComplete={handleSplashComplete} />}
      <SWRConfig 
        value={{
          fetcher: (url) => apiRequest(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
          keepPreviousData: true,
          revalidateOnFocus: true,
        }}
      >
      <Toaster 
        position="bottom-right" 
        reverseOrder={false}
        containerClassName="toast-toaster-container"
        containerStyle={{
          bottom: 20,
          right: 20,
          zIndex: 999999,
        }}
      >
        {(t) => <PremiumToastCard t={t} />}
      </Toaster>
      <ErrorBoundary>
        <Suspense fallback={<Loading fullPage label="Loading..." />}>
          <Routes>
            <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/match-room" element={<MatchRoom />} />
            <Route path="/match-room/:id" element={<MatchRoomDetail />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/history" element={<History />} />
            <Route path="/account" element={<Account />} />
            <Route path="/support" element={<Support />} />
            <Route path="/terms" element={<TermsPrivacy />} />
            <Route path="/term-and-conditions" element={<TermAndConditions />} />
            <Route path="/gst-policy" element={<GstPolicy />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/payment-methods" element={<PaymentMethods />} />
            <Route path="/kyc" element={<Kyc />} />
            <Route path="/practice" element={<PracticeLobby />} />
            <Route path="/practice/waiting/:id" element={<PracticeWaitingRoom />} />
            <Route path="/practice/game/:gameId" element={<PracticeGameRoom />} />
          </Route>

          {/* SECRET OMEGA SEPARATE ADMIN LOGIN ROUTES */}
          <Route path="/omega-admin-login" element={<AdminLogin />} />
          <Route path="/omega-admin" element={<AdminLogin />} />
          <Route path="/secret-omega-admin" element={<AdminLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* ADMIN LAYOUT */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin", "owner", "master", "finance_admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="kyc" element={<AdminKyc />} />
            <Route path="matches" element={<AdminMatches />} />
            <Route path="withdrawals" element={<AdminWithdrawals />} />
            <Route path="contacts" element={<ProtectedRoute allowedRoles={["owner", "master"]}><AdminContacts /></ProtectedRoute>} />
            <Route path="deposit-history" element={<AdminDepositHistory />} />
            <Route path="notifications" element={<AdminNotifications />} />

            {/* OWNER ONLY CONFIGURATION ROUTES */}
            <Route path="dms" element={<ProtectedRoute allowedRoles={["owner", "master"]}><AdminDigitalManagement /></ProtectedRoute>} />
            <Route path="referrals" element={<ProtectedRoute allowedRoles={["owner", "master"]}><AdminReferrals /></ProtectedRoute>} />
            <Route path="site-settings" element={<ProtectedRoute allowedRoles={["owner", "master"]}><AdminSiteSettings /></ProtectedRoute>} />
            <Route path="logs" element={<ProtectedRoute allowedRoles={["owner", "master"]}><AdminLogs /></ProtectedRoute>} />
            <Route path="system-health" element={<ProtectedRoute allowedRoles={["owner", "master"]}><AdminSystemHealth /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      </SWRConfig>
    </>
  );
}
