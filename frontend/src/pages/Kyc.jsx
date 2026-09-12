import { useEffect, useState, useRef } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import Loading from "../components/Loading.jsx";
import AadhaarCard from "../components/AadhaarCard.jsx";
import { getMyKyc, sendAadhaarOtp, verifyAadhaarOtp } from "../lib/kycApi.js";
import { friendlyError } from "../lib/errors.js";
import toast from "react-hot-toast";
import "./Kyc.css";

const STATUS_LABEL = {
  pending: "Under Review",
  verified: "Verified",
  rejected: "Rejected",
};

const UIDAI_LOGO_URL = "https://upload.wikimedia.org/wikipedia/en/c/cf/Aadhaar_Logo.svg";

export default function Kyc() {
  const { user, token, isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();

  const { data: kyc, error, mutate } = useSWR(
    isAuthenticated ? "/kyc/me" : null,
    () => getMyKyc(token)
  );
  const loading = !kyc && !error;

  const [step, setStep] = useState("send"); // "send" | "verify"
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState("");
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [otpError, setOtpError] = useState("");
  const lastTriedOtpRef = useRef("");

  const handleOtpChange = (val) => {
    const clean = val.replace(/\D/g, "").slice(0, 6);
    setOtp(clean);
    if (clean !== lastTriedOtpRef.current) {
      setOtpError("");
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();

    const cleanedAadhaar = aadhaarNumber.replace(/\D/g, "");
    if (cleanedAadhaar.length !== 12) {
      toast.error("Enter 12-digit Aadhaar number.");
      return;
    }

    setSubmitting(true);
    setOtpError("");
    lastTriedOtpRef.current = "";
    try {
      const result = await sendAadhaarOtp(token, { aadhaarNumber: cleanedAadhaar });
      setRequestId(result.request_id);
      setStep("verify");
      setOtp("");
      toast.success("OTP sent to Aadhaar mobile!");
    } catch (err) {
      toast.error(friendlyError(err, "Could not send OTP."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      toast.error("Enter 6-digit OTP.");
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    setOtpError("");
    try {
      await verifyAadhaarOtp(token, { aadhaarNumber, requestId, otp: cleanOtp });
      mutate();
      toast.success("Aadhaar verified!");
      setStep("send");
      setAadhaarNumber("");
      setOtp("");
      setRequestId("");
      lastTriedOtpRef.current = "";
    } catch (err) {
      lastTriedOtpRef.current = cleanOtp;
      const errMsg = friendlyError(err, "Invalid OTP or verification failed.");
      setOtpError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit OTP when 6 digits entered — ONLY if this exact OTP has not already failed!
  useEffect(() => {
    if (step === "verify" && otp.length === 6 && otp !== lastTriedOtpRef.current && !submitting) {
      handleVerifyOtp();
    }
  }, [otp, step, submitting]);

  const load = () => {
    mutate();
  };

  if (initializing) {
    return <Loading label="Loading KYC details..." />;
  }

  const clearOtp = () => {
    setOtp("");
    setOtpError("");
    lastTriedOtpRef.current = "";
  };

  return (
    <div className="stack" style={{ gap: "20px" }}>
      <div>
        <h1>Aadhaar Identity Verification</h1>
        <p className="text-muted" style={{ margin: "2px 0 0" }}>
          Official UIDAI Aadhaar verification for player identity security.
        </p>
      </div>

      {error && (
        <p className="notice-banner row-between">
          <span>{friendlyError(error)}</span>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            Retry
          </button>
        </p>
      )}

      {loading ? (
        <Loading label="Loading KYC status..." />
      ) : (
        <>
          {kyc && (
            <div className="stack" style={{ gap: "16px" }}>
              {/* OFFICIAL UIDAI AADHAAR CARD UI */}
              <AadhaarCard kyc={kyc} user={user} />

              {/* READ-ONLY NOTICE FOR VERIFIED USERS */}
              {kyc.status === "verified" && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "12px 16px", borderRadius: "12px", fontSize: "13px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  <div>
                    <strong>Identity Verified & Locked</strong>
                    <p style={{ margin: "2px 0 0", fontSize: "12px" }}>Your Aadhaar identity details are verified and non-editable.</p>
                  </div>
                </div>
              )}

              {kyc.status === "rejected" && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "14px", borderRadius: "12px" }}>
                  <p style={{ margin: "0 0 4px", fontWeight: "bold" }}>Rejection Reason:</p>
                  <p style={{ margin: 0, fontSize: "14px" }}>{kyc.note || "Aadhaar verification failed. Please check your details and try again."}</p>
                </div>
              )}
            </div>
          )}

          {/* SUBMISSION FORM (When not verified or resubmitting) */}
          {kyc?.status !== "verified" && kyc?.status !== "pending" && (
            <div className="card stack" style={{ padding: "20px" }}>
              <h3 style={{ margin: "0 0 12px" }}>
                {kyc?.status === "rejected" ? "Resubmit Aadhaar Verification" : "Enter Aadhaar Number"}
              </h3>

              {step === "send" ? (
                <form className="stack" onSubmit={handleSendOtp}>
                  <div className="field">
                    <label htmlFor="aadhaar-number">12-Digit Aadhaar Number</label>
                    <input
                      id="aadhaar-number"
                      className="input"
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="Enter 12-digit Aadhaar number"
                      value={aadhaarNumber}
                      onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      disabled={submitting}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                    {submitting ? "Sending OTP..." : "Get Aadhaar OTP"}
                  </button>
                </form>
              ) : (
                <form className="stack" onSubmit={handleVerifyOtp}>
                  <p className="text-faint">
                    An OTP has been sent to the mobile number registered with your Aadhaar card.
                  </p>
                  
                  <div className="field">
                    <label htmlFor="otp">Enter 6-Digit OTP</label>
                    <input
                      id="otp"
                      className="input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit OTP"
                      value={otp}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      disabled={submitting}
                      autoFocus
                    />
                  </div>

                  {otpError && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
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

                  <button type="submit" className="btn btn-primary btn-block" disabled={submitting || otp.length !== 6}>
                    {submitting ? "Verifying OTP..." : "Verify Aadhaar"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-block" disabled={submitting} onClick={() => { setStep("send"); clearOtp(); }}>
                    Change Aadhaar Number
                  </button>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
