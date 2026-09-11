import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Loading from "../components/Loading.jsx";
import { getWalletHistory } from "../lib/walletApi.js";
import { requestWithdrawal } from "../lib/withdrawalApi.js";
import { addPayoutMethod, getPayoutMethods } from "../lib/paymentMethodsApi.js";
import { createPaymentOrder, getPaymentOrderStatus } from "../lib/paymentApi.js";
import { getMyKyc } from "../lib/kycApi.js";
import { friendlyError } from "../lib/errors.js";
import toast from "react-hot-toast";
import { apiRequest } from "../lib/apiClient.js";
import "./Wallet.css";

const PENDING_ORDER_STORAGE_KEY = "mpc_pending_order_id";

function formatCoins(n) {
  return n.toLocaleString();
}

export default function Wallet() {
  const { token, user, wallet, refreshWallet, isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedAction = searchParams.get("action");

  const [activeModal, setActiveModal] = useState(
    ["add", "withdraw", "pay", "promo", "details"].includes(requestedAction) ? requestedAction : null
  );
  const { data: kycData } = useSWR(isAuthenticated ? "/kyc/me" : null);
  const { data: siteSettings } = useSWR("/settings");
  // Fetch payout methods lazily when activeModal === "withdraw"
  const { data: payoutMethodsData } = useSWR(
    isAuthenticated && activeModal === "withdraw" ? "/payout-methods" : null
  );

  const kycStatus = kycData?.status || "none";
  const siteSettingsData = siteSettings || null;
  const payoutMethods = payoutMethodsData || [];

  const [wdStep, setWdStep] = useState(1);
  const [wdMethod, setWdMethod] = useState("bank");
  const [wdAmount, setWdAmount] = useState("");
  const [wdUpiId, setWdUpiId] = useState("");
  const [wdAccountHolder, setWdAccountHolder] = useState("");
  const [wdAccountNumber, setWdAccountNumber] = useState("");
  const [wdIfsc, setWdIfsc] = useState("");
  const [wdError, setWdError] = useState("");
  const [wdSuccess, setWdSuccess] = useState("");
  const [wdSubmitting, setWdSubmitting] = useState(false);
  const [wdSaveMethod, setWdSaveMethod] = useState(false);

  const [payAmount, setPayAmount] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

  const [pendingOrder, setPendingOrder] = useState(null);
  const [pendingOrderChecking, setPendingOrderChecking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    checkPendingOrder();

    const handleRefresh = () => {
      refreshWallet();
      mutate("/kyc/me");
      mutate("/settings");
    };
    window.addEventListener("app:refresh", handleRefresh);
    return () => window.removeEventListener("app:refresh", handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!pendingOrder || pendingOrder.status !== "pending") return;

    const interval = setInterval(() => {
      checkPendingOrder();
    }, 4000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrder?.status, pendingOrder?.orderId]);

  function checkPendingOrder() {
    const urlOrderId = searchParams.get("order_id") || searchParams.get("orderId") || searchParams.get("order_no");
    const orderId = urlOrderId || localStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!orderId) return;

    setPendingOrderChecking(true);
    getPaymentOrderStatus(token, orderId)
      .then((order) => {
        setPendingOrder(order);
        if (order.status === "success") {
          toast.success(`₹${order.amount} deposited successfully!`);
          localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
          refreshWallet();
          mutate("/wallet/history");
          if (urlOrderId) {
            navigate("/wallet", { replace: true });
          }
        } else if (order.status === "failed") {
          toast.error("Payment failed.");
          localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
          if (urlOrderId) {
            navigate("/wallet", { replace: true });
          }
        }
      })
      .catch(() => {
        localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
        setPendingOrder(null);
      })
      .finally(() => setPendingOrderChecking(false));
  }

  const dismissPendingOrder = () => {
    localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    setPendingOrder(null);
  };

  if (initializing) {
    return <Loading label="Loading wallet..." />;
  }

  const openWithdrawModal = () => {
    setWdStep(1);
    setWdMethod("bank");
    setWdAmount("");
    setWdUpiId("");
    setWdAccountHolder(kycData?.name || user?.name || "");
    setWdAccountNumber("");
    setWdIfsc("");
    setWdError("");
    setWdSuccess("");
    setWdSaveMethod(false);
    setActiveModal("withdraw");
  };

  const selectMethod = (method) => {
    setWdMethod(method);
    setWdStep(2);
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setWdError("");
    setWdSuccess("");

    const amount = Number(wdAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Enter valid coin amount.");
      return;
    }
    if (wdMethod === "upi" && !wdUpiId.trim()) {
      toast.error("Enter your UPI ID.");
      return;
    }
    if (wdMethod === "bank" && (!wdAccountHolder.trim() || !wdAccountNumber.trim() || !wdIfsc.trim())) {
      toast.error("Fill all bank account details.");
      return;
    }

    setWdSubmitting(true);
    try {
      const payload = { amount, payoutMethod: wdMethod };
      if (wdMethod === "upi") payload.upiId = wdUpiId.trim();
      else {
        payload.accountHolderName = wdAccountHolder.trim();
        payload.accountNumber = wdAccountNumber.trim();
        payload.ifsc = wdIfsc.trim();
      }

      await requestWithdrawal(token, payload);
      if (wdSaveMethod) {
        await addPayoutMethod(token, { method: wdMethod, ...payload }).catch(() => {});
      }
      await refreshWallet();
      mutate("/wallet/history");
      toast.success("Withdrawal submitted!");
      setWdSuccess("Withdrawal request submitted. It's now pending review.");
    } catch (err) {
      toast.error(friendlyError(err));
      setWdError(friendlyError(err));
    } finally {
      setWdSubmitting(false);
    }
  };

  const handlePay = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const amount = Number(payAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Enter valid amount.");
      return;
    }

    const rawMobile = user?.phone || user?.mobile || user?.phoneNumber || "9828786246";
    const customerMobile = String(rawMobile).replace(/\D/g, "").slice(-10) || "9828786246";

    setPaySubmitting(true);
    try {
      const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
      const redirectUrl = `${window.location.origin}/wallet?order_id=${orderId}`;

      const order = await createPaymentOrder(token, {
        amount,
        customerMobile,
        redirectUrl,
        orderId,
      });

      const paymentUrl = order?.paymentUrl || order?.payment_url;
      if (!paymentUrl) {
        toast.error(order?.message || "Payment link unavailable. Please try again.");
        setPaySubmitting(false);
        return;
      }

      localStorage.setItem(PENDING_ORDER_STORAGE_KEY, order.orderId || orderId);

      // Smooth location redirect to payment gateway widget / URL
      window.location.href = paymentUrl;
    } catch (err) {
      console.error("Payment creation error:", err);
      const errorMessage = err?.message || friendlyError(err);
      toast.error(errorMessage);
      setPaySubmitting(false);
    }
  };

  if (activeModal === "withdraw") {
    return (
      <div className="wallet-wd-page">
        <div className="wallet-wd-header row-between">
          <button className="btn btn-primary btn-sm" onClick={() => (wdStep === 2 ? setWdStep(1) : setActiveModal(null))}>← Back</button>
        </div>

        {!kycData ? (
          <Loading label="Checking KYC status..." />
        ) : kycStatus !== "verified" ? (
          <div className="stack" style={{ padding: '20px' }}>
            <EmptyState
              icon="🪪"
              title="KYC verification required"
              description="Please complete KYC before requesting a withdrawal."
            />
            <Link to="/kyc" className="btn btn-primary btn-block">Go to KYC</Link>
          </div>
        ) : wdSuccess ? (
          <div className="stack" style={{ padding: '20px' }}>
            <p className="notice-banner">{wdSuccess}</p>
            <button className="btn btn-secondary btn-block" onClick={() => setActiveModal(null)}>Close</button>
          </div>
        ) : (
          <div className="wallet-wd-content">
            <div className="wallet-wd-banner">
              <div className="wallet-wd-title">Select Payment Mode</div>
              <div className="wallet-wd-subtitle">Withdrawal Chips: {wallet ? formatCoins(wallet.winningCoins) : "0"}</div>
              <div className="wallet-wd-limits row-between">
                <span>Minimum: {siteSettingsData?.minWithdrawal ?? 300}</span>
                <span>Maximum: {formatCoins(siteSettingsData?.maxWithdrawal ?? 100000)}</span>
              </div>
            </div>

            {wdStep === 1 && (
              <div className="wallet-wd-methods">
                <button className="wallet-wd-method-btn" onClick={() => selectMethod("bank")}>
                  <strong>BANK / IMPS</strong> <sup>(INSTANT)</sup>
                </button>
                <button className="wallet-wd-method-btn" onClick={() => selectMethod("upi")}>
                  <strong>UPI</strong>
                  <div className="wallet-wd-method-sub">UNIFIED PAYMENTS INTERFACE</div>
                </button>
              </div>
            )}

            {wdStep === 2 && (
              <form className="wallet-wd-form" onSubmit={handleWithdraw}>
                <div className="wallet-wd-form-header">
                  {wdMethod === "bank" ? "Bank Account Details" : "UPI Payment Details"}
                </div>
                <div className="wallet-wd-form-body stack">
                  {wdMethod === "bank" ? (
                    <>
                      <div className="field">
                        <label className="row-between">
                          <span>Account Holder Name</span>
                          <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: "bold" }}>🔒 KYC Verified</span>
                        </label>
                        <input
                          className="input"
                          type="text"
                          value={wdAccountHolder || kycData?.name || user?.name || ""}
                          readOnly={true}
                          disabled={true}
                          style={{ background: "var(--surface-alt)", cursor: "not-allowed", fontWeight: "bold" }}
                        />
                        <span className="text-faint" style={{ fontSize: "11px", marginTop: "-4px" }}>
                          Payout recipient name is pre-filled from your verified identity.
                        </span>
                      </div>
                      <div className="field">
                        <label>Bank Account Number</label>
                        <input className="input" type="text" placeholder="Your Bank Account Number" inputMode="numeric" value={wdAccountNumber} onChange={(e) => setWdAccountNumber(e.target.value)} disabled={wdSubmitting} />
                      </div>
                      <div className="field">
                        <label>IFSC Code</label>
                        <input className="input" type="text" placeholder="IFSC Code" value={wdIfsc} onChange={(e) => setWdIfsc(e.target.value.toUpperCase())} disabled={wdSubmitting} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <label className="row-between">
                          <span>Account Holder Name</span>
                          <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: "bold" }}>🔒 KYC Verified</span>
                        </label>
                        <input
                          className="input"
                          type="text"
                          value={wdAccountHolder || kycData?.name || user?.name || ""}
                          readOnly={true}
                          disabled={true}
                          style={{ background: "var(--surface-alt)", cursor: "not-allowed", fontWeight: "bold" }}
                        />
                        <span className="text-faint" style={{ fontSize: "11px", marginTop: "-4px" }}>
                          Payout recipient name is pre-filled from your verified identity.
                        </span>
                      </div>
                      <div className="field">
                        <label>UPI ID</label>
                        <input className="input" type="text" placeholder="Your UPI ID" value={wdUpiId} onChange={(e) => setWdUpiId(e.target.value)} disabled={wdSubmitting} />
                      </div>
                    </>
                  )}
                  <div className="field">
                    <label>Chips</label>
                    <input className="input" type="number" placeholder="Chips" value={wdAmount} onChange={(e) => setWdAmount(e.target.value)} disabled={wdSubmitting} />
                  </div>
                  
                  <p className="wallet-wd-terms">
                    By Continuing, you agree to our Legal Terms and you are 18 years or older.
                  </p>
                  
                  <button type="submit" className="btn wallet-wd-sell-btn btn-block" disabled={wdSubmitting}>
                    {wdSubmitting ? "Processing..." : "Sell"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full-page Buy Chips Deposit Flow
  if (activeModal === "pay") {
    const numAmount = Number(payAmount) || 0;
    const formattedAmount = numAmount.toFixed(2);
    const presets = [100, 200, 500, 1000, 2000, 5000, 7500, 10000];

    return (
      <div className="wallet-pay-page">
        {/* Top Header Row with Back Button */}
        <div className="wallet-pay-header row-between">
          <button className="btn btn-primary btn-sm" onClick={() => setActiveModal(null)}>
            ← Back
          </button>
        </div>

        {/* Warning Notice Banner */}
        <div className="pay-notice-banner">
          <span className="pay-notice-icon">⚠️</span>
          <span>
            <strong>Payment Only ( Phone Pay- Google Pay - Paytm ) से डाले!</strong> अलग wallet से डालेंगे तो Add नही होगा
          </span>
        </div>

        {/* Card 1: Buy Chips */}
        <div className="pay-card">
          <div className="pay-card-header">Buy Chips</div>
          <div className="pay-card-body">
            <div className="pay-field-label">Enter Amount</div>
            
            <div className="pay-input-group">
              <div className="pay-input-prefix">₹</div>
              <input
                type="number"
                inputMode="numeric"
                className="pay-input-field"
                placeholder="Amount"
                min={siteSettingsData?.minDeposit ?? 100}
                max={siteSettingsData?.maxDeposit ?? 100000}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                disabled={paySubmitting}
              />
            </div>

            {/* Quick Amount Preset Chips */}
            <div className="pay-preset-chips">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`pay-chip-btn ${Number(payAmount) === preset ? "is-active" : ""}`}
                  onClick={() => setPayAmount(preset.toString())}
                  disabled={paySubmitting}
                >
                  ₹{preset}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="pay-proceed-btn"
              onClick={handlePay}
              disabled={paySubmitting || !payAmount || Number(payAmount) <= 0}
            >
              {paySubmitting ? "Redirecting..." : "Proceed"}
            </button>
          </div>
        </div>

        {/* Card 2: Summary */}
        <div className="pay-card">
          <div className="pay-card-header">Summary</div>
          <div className="pay-card-body pay-summary-body">
            <div className="pay-summary-row">
              <span>
                Deposit Amount (Excl. Govt. Tax) <span className="pay-tag-badge tag-a">A</span>
              </span>
              <span className="pay-val-green">₹{formattedAmount}</span>
            </div>

            <div className="pay-summary-row">
              <span>Govt. Tax (28% GST)</span>
              <span>₹0.00</span>
            </div>

            <div className="pay-summary-divider" />

            <div className="pay-summary-row">
              <span>Total</span>
              <span>₹{formattedAmount}</span>
            </div>

            <div className="pay-summary-row">
              <span>
                Cashback Bonus <span className="pay-tag-badge tag-b">B</span>
              </span>
              <span className="pay-val-green">₹ 0.00</span>
            </div>

            <div className="pay-summary-divider" />

            <div className="pay-summary-row pay-summary-total">
              <span>
                <strong>Add To Wallet Balance</strong>{" "}
                <span className="pay-tag-badge tag-a">A</span> + <span className="pay-tag-badge tag-b">B</span>
              </span>
              <span className="pay-val-green-bold">₹ {formattedAmount}</span>
            </div>
          </div>
        </div>

        {/* Footer: Payments Secured By */}
        <div className="pay-secured-section">
          <div className="pay-secured-title">Payments Secured By</div>
          <img src="/upi.png" alt="Payments Secured By" className="pay-secured-img" />
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-page stack">
      <div className="wallet-top-bar row-between">
        <button className="btn btn-primary wallet-btn-back" onClick={() => navigate(-1)}>← Back</button>
        <button className="btn btn-outline wallet-btn-history" onClick={() => navigate("/history")}>Wallet History</button>
      </div>

      {pendingOrder && (
        <p className="notice-banner row-between">
          <span>
            {pendingOrder.status === "success"
              ? `Payment of ₹${pendingOrder.amount} confirmed — coins credited.`
              : pendingOrder.status === "failed"
                ? `Payment of ₹${pendingOrder.amount} failed or was cancelled.`
                : `Payment of ₹${pendingOrder.amount} is pending confirmation.`}
          </span>
          <span className="row">
            {pendingOrder.status === "pending" && (
              <button className="btn btn-ghost btn-sm" onClick={checkPendingOrder} disabled={pendingOrderChecking}>
                {pendingOrderChecking ? "Checking..." : "Refresh"}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={dismissPendingOrder}>
              Dismiss
            </button>
          </span>
        </p>
      )}

      {kycStatus !== "verified" && (
        <Link to="/kyc" style={{ textDecoration: "none" }}>
          <div className="notice-banner row-between" style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #f87171", margin: "10px 0", borderRadius: "8px", fontWeight: "bold" }}>
            <span>⚠️ KYC is required for withdrawals. Click to complete.</span>
            <span>→</span>
          </div>
        </Link>
      )}
      {!wallet ? (
        <Loading label="Loading wallet..." />
      ) : (
        <div className="wallet-card-container">
          <div className="account-ui-card wallet-balance-card">
            <div className="account-ui-header">Deposit Chips</div>
            <div className="account-ui-body wallet-balance-body">
              <div className="account-ui-field wallet-balance-field">
                <div className="account-ui-input wallet-balance-val">
                  {wallet ? formatCoins(wallet.depositCoins) : "0"}
                </div>
              </div>
              <button className="wallet-btn-add" onClick={() => setActiveModal("pay")}>Add</button>
            </div>
          </div>

          <div className="account-ui-card wallet-balance-card">
            <div className="account-ui-header">Winning Chips</div>
            <div className="account-ui-body wallet-balance-body">
              <div className="account-ui-field wallet-balance-field">
                <div className="account-ui-input wallet-balance-val">
                  {wallet ? formatCoins(wallet.winningCoins) : "0"}
                </div>
              </div>
              <button className="wallet-btn-withdraw" onClick={openWithdrawModal}>Withdraw</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
