import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import OtpInput from "../components/OtpInput.jsx";
import { friendlyError } from "../lib/errors.js";
import toast from "react-hot-toast";
import "./Login.css";

const RESEND_COOLDOWN_SECONDS = 60;
const REF_STORAGE_KEY = "mpc_pending_ref";

const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
  </svg>
);

export default function Login() {
  const { sendAuthOtp, verifyAuthOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState("form");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [otp, setOtp] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState("");
  const lastTriedOtpRef = useRef("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refParam = params.get("ref") || params.get("referral") || location.state?.ref;
    if (refParam) {
      const code = String(refParam).trim().toUpperCase();
      sessionStorage.setItem(REF_STORAGE_KEY, code);
      setReferralCode(code);
    } else {
      const storedRef = sessionStorage.getItem(REF_STORAGE_KEY);
      if (storedRef) setReferralCode(storedRef);
    }
  }, [location]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleOtpChange = (val) => {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    setOtp(clean);
    if (clean !== lastTriedOtpRef.current) {
      setOtpError("");
    }
  };

  const doVerify = useCallback(async (otpValue) => {
    const cleanOtp = (otpValue || otp).trim();
    if (cleanOtp.length !== 6 || verifyingOtp) return;

    setVerifyingOtp(true);
    setOtpError("");
    try {
      const res = await verifyAuthOtp({ phone: otpPhone, otp: cleanOtp, referralCode });
      sessionStorage.removeItem(REF_STORAGE_KEY);
      toast.success(res.isNewUser ? "Account created! Welcome 👋" : "Login successful!");
      navigate("/");
    } catch (err) {
      lastTriedOtpRef.current = cleanOtp;
      const errMsg = friendlyError(err, "Invalid OTP.");
      setOtpError(errMsg);
      toast.error(errMsg);
    } finally {
      setVerifyingOtp(false);
    }
  }, [otp, verifyingOtp, otpPhone, referralCode, verifyAuthOtp, navigate]);

  // Auto-verify when 6 digits entered — ONLY if this exact OTP has not already failed!
  useEffect(() => {
    if (step === "otp" && otp.length === 6 && otp !== lastTriedOtpRef.current && !verifyingOtp) {
      doVerify(otp);
    }
  }, [otp, step, verifyingOtp, doVerify]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (phone.length !== 10) {
      toast.error("Enter 10-digit mobile number.");
      return;
    }
    setSendingOtp(true);
    try {
      const result = await sendAuthOtp({ phone, referralCode });
      setOtpPhone(result.phone || phone);
      setOtp("");
      setOtpError("");
      lastTriedOtpRef.current = "";
      setStep("otp");
      toast.success("OTP sent to mobile!");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(friendlyError(err, "Failed to send OTP."));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setOtpError("");
    try {
      await sendAuthOtp({ phone: otpPhone, referralCode });
      toast.success("OTP resent!");
      setOtp("");
      lastTriedOtpRef.current = "";
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(friendlyError(err, "Failed to resend OTP."));
    } finally {
      setResending(false);
    }
  };

  const changeNumber = () => {
    setStep("form");
    setOtp("");
    setOtpError("");
    lastTriedOtpRef.current = "";
  };

  const clearOtp = () => {
    setOtp("");
    setOtpError("");
    lastTriedOtpRef.current = "";
  };

  return (
    <div className="login-page">
      {/* 1. Top Bonus Banner Container */}
      <div className="login-bonus-container">
        Register Now &amp; Get ₹20 Free Signup Bonus ⭐
      </div>

      {/* 2. Separate Login Card Container */}
      <div className="login-card-container">
        {/* Title */}
        <div className="login-card-title">
          {step === "form" ? "Login" : "Verify OTP"}
        </div>

        {/* Referral Badge */}
        {referralCode && (
          <div className="login-referral-badge">
            🎁 Referral Applied: <strong>{referralCode}</strong>
          </div>
        )}

        {step === "form" ? (
          <form onSubmit={handleSendOtp}>
            {/* Mobile Number Field */}
            <div className="login-field">
              <label className="login-label" htmlFor="phone">Mobile Number</label>
              <div className="login-phone-row">
                <div className="login-phone-icon">
                  <PhoneIcon />
                </div>
                <input
                  id="phone"
                  className="login-phone-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  autoFocus
                />
              </div>
            </div>

            {/* Legal Terms */}
            <p className="login-legal">
              By Continuing, you agree to our{" "}
              <Link to="/term-and-conditions" className="login-legal-link">
                Legal Terms
              </Link>{" "}
              and you are 18 years or older.
            </p>

            {/* GET OTP Button */}
            <button
              type="submit"
              className="login-otp-btn"
              disabled={sendingOtp || phone.length !== 10}
            >
              {sendingOtp ? "Sending..." : "GET OTP"}
            </button>

            {/* Register Link */}
            <p className="login-register-text">
              Don't have an account?{" "}
              <Link to="/login" className="login-register-link">Register</Link>
            </p>
          </form>
        ) : (
          <div>
            <p className="login-otp-hint">
              We sent a 6-digit OTP to <strong>+91 {otpPhone}</strong>
            </p>

            <div className="login-field">
              <label className="login-label">Enter OTP</label>
              <OtpInput
                length={6}
                value={otp}
                onChange={handleOtpChange}
                disabled={verifyingOtp}
              />
            </div>

            {verifyingOtp && (
              <p className="login-verifying-text">Verifying OTP...</p>
            )}

            {otpError && (
              <div style={{ marginTop: "12px", background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <span>⚠️ {otpError}</span>
                <button
                  type="button"
                  style={{ background: "#ef4444", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}
                  onClick={clearOtp}
                >
                  Clear OTP
                </button>
              </div>
            )}

            <div style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="login-otp-btn"
                disabled={verifyingOtp || otp.length !== 6}
                onClick={() => doVerify(otp)}
                style={{ marginBottom: "12px" }}
              >
                {verifyingOtp ? "Verifying..." : "VERIFY OTP"}
              </button>
            </div>

            <p className="login-register-text" style={{ marginTop: "8px" }}>
              {resendCooldown > 0 ? (
                <span>Resend OTP in {resendCooldown}s</span>
              ) : (
                <button type="button" className="login-register-link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} disabled={resending} onClick={handleResendOtp}>
                  {resending ? "Resending..." : "Resend OTP"}
                </button>
              )}
              {" · "}
              <button type="button" className="login-register-link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} onClick={changeNumber}>
                Change Number
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
