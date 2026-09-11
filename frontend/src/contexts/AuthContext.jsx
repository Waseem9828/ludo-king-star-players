import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { decodeJwtPayload } from "../lib/jwt.js";
import { fetchCurrentUser, sendLoginOtp, verifyLoginOtp, sendRegisterOtp, verifyRegisterOtp, sendUnifiedOtp, verifyUnifiedOtp } from "../lib/authApi.js";
import { getWallet } from "../lib/walletApi.js";
import { updateProfile as updateProfileRequest } from "../lib/usersApi.js";
import { getUnreadNotificationCount } from "../lib/notificationApi.js";

const AuthContext = createContext(null);
const TOKEN_STORAGE_KEY = "mpc_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, name, role, status }
  const [token, setToken] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [wallet, setWallet] = useState(null); // { totalCoins, depositCoins, winningCoins, bonusCoins }
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshWallet = useCallback((rawToken) => {
    const activeToken = rawToken || token;
    if (!activeToken) return Promise.resolve(null);
    return getWallet(activeToken)
      .then((data) => {
        setWallet((prev) => {
          if (
            prev &&
            (prev.depositCoins !== data.depositCoins ||
              prev.winningCoins !== data.winningCoins ||
              prev.bonusCoins !== data.bonusCoins ||
              prev.totalCoins !== data.totalCoins)
          ) {
            window.dispatchEvent(new CustomEvent("app:refresh"));
          }
          return data;
        });
        return data;
      })
      .catch(() => null);
  }, [token]);

  const refreshUnreadNotifications = useCallback((rawToken) => {
    const activeToken = rawToken || token;
    if (!activeToken) return Promise.resolve(null);
    return getUnreadNotificationCount(activeToken)
      .then((data) => {
        setUnreadNotifications(data.count);
        return data.count;
      })
      .catch(() => null);
  }, [token]);

  // Restore a session from a previously stored token, verified against the
  // real backend (not just decoded) so a stale/invalid token can't fake a role.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      setInitializing(false);
      return;
    }

    fetchCurrentUser(stored)
      .then(({ user: freshUser }) => {
        setUser(freshUser);
        setToken(stored);
        refreshUnreadNotifications(stored);
        return refreshWallet(stored);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => setInitializing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time background sync loop: refreshes wallet coins & unread notifications every 6 seconds, and on tab focus
  useEffect(() => {
    if (!token) return;
    const sync = () => {
      refreshWallet(token);
      refreshUnreadNotifications(token);
    };

    const interval = setInterval(sync, 6000);

    const handleFocus = () => sync();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [token, refreshWallet, refreshUnreadNotifications]);

  const applySession = (rawToken, sessionUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, rawToken);
    setToken(rawToken);
    setUser(sessionUser);
    refreshWallet(rawToken);
    refreshUnreadNotifications(rawToken);
  };

  // OTP-based auth: "send" just triggers the SMS (no session yet); "verify"
  // completes login and applies the session on a correct OTP. Accounts are
  // never self-registered from the app — only an admin creates them
  // (POST /api/admin/users) — so there is no register step here.
  const sendAuthOtp = (payload) => sendUnifiedOtp(payload);

  const verifyAuthOtp = async ({ phone, otp, referralCode, name }) => {
    const res = await verifyUnifiedOtp({ phone, otp, referralCode, name });
    applySession(res.token, res.user);
    return res;
  };

  const loginSendOtp = (payload) => sendLoginOtp(payload);

  const loginVerifyOtp = async ({ phone, otp }) => {
    const { token: newToken, user: newUser } = await verifyLoginOtp({ phone, otp });
    applySession(newToken, newUser);
  };

  const registerSendOtp = async ({ name, phone, referralCode }) => {
    return await sendRegisterOtp({ name, phone, referralCode });
  };

  const registerVerifyOtp = async ({ phone, otp }) => {
    const { token: newToken, user: newUser } = await verifyRegisterOtp({ phone, otp });
    applySession(newToken, newUser);
  };

  const updateProfile = async ({ name }) => {
    const updatedUser = await updateProfileRequest(token, { name });
    setUser(updatedUser);
    return updatedUser;
  };

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setToken(null);
    setWallet(null);
    setUnreadNotifications(0);
  }, []);

  useEffect(() => {
    const handleLogout = () => logout();
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role ?? null,
      isAuthenticated: Boolean(token),
      initializing,
      wallet,
      refreshWallet,
      unreadNotifications,
      refreshUnreadNotifications,
      sendAuthOtp,
      verifyAuthOtp,
      loginSendOtp,
      loginVerifyOtp,
      registerSendOtp,
      registerVerifyOtp,
      updateProfile,
      logout,
    }),
    [user, token, initializing, wallet, refreshWallet, unreadNotifications, refreshUnreadNotifications]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
