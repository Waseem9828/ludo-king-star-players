import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { sendAdminOtp, verifyAdminOtp } from "../../lib/authApi.js";
import { friendlyError } from "../../lib/errors.js";
import toast from "react-hot-toast";
import "./AdminLogin.css";

export default function AdminLogin() {
  const { isAuthenticated, role, setSessionToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  // If already authenticated as admin, redirect directly to dashboard
  useEffect(() => {
    if (isAuthenticated && ["admin", "owner", "master", "finance_admin"].includes(role)) {
      navigate("/admin", { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const handleSendOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await sendAdminOtp({ phone: cleanPhone });
      toast.success(res.message || "OTP sent to your registered admin mobile number.");
      setStep(2);
      setResendSeconds(res.expiresInSeconds || 30);
    } catch (err) {
      toast.error(friendlyError(err, "Failed to send Admin OTP. Check authorization."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      toast.error("Please enter the verification OTP.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await verifyAdminOtp({ phone: cleanPhone, otp: cleanOtp });
      toast.success("Admin Authentication Verified!");
      
      if (data.token) {
        setSessionToken(data.token);
        setTimeout(() => {
          navigate("/admin", { replace: true });
        }, 300);
      }
    } catch (err) {
      toast.error(friendlyError(err, "Invalid OTP or unauthorized access."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        {/* Header Shield */}
        <div className="admin-login-header">
          <div className="admin-login-badge">🛡️ OMEGA SECURITY</div>
          <h1 className="admin-login-title">Admin Control Portal</h1>
          <p className="admin-login-sub">Enter your authorized administrator mobile number to log in</p>
        </div>

        {step === 1 ? (
          <form className="admin-login-form" onSubmit={handleSendOtp}>
            <div className="admin-login-field">
              <label>Administrator Mobile Number</label>
              <div className="admin-login-input-group">
                <span className="admin-login-prefix">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className="admin-login-input"
                  placeholder="Enter 10-digit Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  disabled={submitting}
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className="admin-login-btn" disabled={submitting || phone.length < 10}>
              {submitting ? "Verifying..." : "Send Verification OTP →"}
            </button>
          </form>
        ) : (
          <form className="admin-login-form" onSubmit={handleVerifyOtp}>
            <div className="admin-login-notice">
              <span>📱 OTP sent to <strong>+91 {phone}</strong></span>
              <button
                type="button"
                className="admin-login-change-btn"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                }}
              >
                Change Number
              </button>
            </div>

            <div className="admin-login-field">
              <label>Enter Verification OTP</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="admin-login-input admin-otp-input"
                placeholder="• • • • • •"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={submitting}
                autoFocus
              />
            </div>

            <button type="submit" className="admin-login-btn" disabled={submitting || !otp}>
              {submitting ? "Authenticating..." : "Verify & Access Admin Dashboard →"}
            </button>

            <div className="admin-login-resend">
              {resendSeconds > 0 ? (
                <span>Resend OTP in <strong>{resendSeconds}s</strong></span>
              ) : (
                <button
                  type="button"
                  className="admin-resend-link"
                  onClick={handleSendOtp}
                  disabled={submitting}
                >
                  Resend OTP
                </button>
              )}
            </div>
          </form>
        )}

        <div className="admin-login-footer">
          🔒 Encrypted 256-Bit Administrative Authorization Session
        </div>
      </div>
    </div>
  );
}
