import { useState } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Loading from "../components/Loading.jsx";
import Modal from "../components/Modal.jsx";
import { PlusIcon } from "../components/Icons.jsx";
import {
  addPayoutMethod,
  deletePayoutMethod,
  getDepositMethods,
  getPayoutMethods,
  setDefaultPayoutMethod,
} from "../lib/paymentMethodsApi.js";
import { friendlyError } from "../lib/errors.js";
import "./PaymentMethods.css";

export default function PaymentMethods() {
  const { token, isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();

  const { data: deposits, error: depError, mutate: mutateDeposits } = useSWR(isAuthenticated ? "/wallet/deposit-methods" : null);
  const { data: payouts, error: payError, mutate: mutatePayouts } = useSWR(isAuthenticated ? "/wallet/payout-methods" : null);

  const data = deposits && payouts ? { deposits, payouts } : null;
  const swrError = depError || payError;

  const loading = !data && !swrError;
  const error = swrError ? friendlyError(swrError) : "";

  const depositMethods = deposits || [];
  const payoutMethods = payouts || [];

  const [actingId, setActingId] = useState(null);

  const [isAddOpen, setAddOpen] = useState(false);
  const [addMethod, setAddMethod] = useState("upi");
  const [addLabel, setAddLabel] = useState("");
  const [addUpiId, setAddUpiId] = useState("");
  const [addAccountHolder, setAddAccountHolder] = useState("");
  const [addAccountNumber, setAddAccountNumber] = useState("");
  const [addIfsc, setAddIfsc] = useState("");
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  if (initializing) {
    return <Loading label="Loading..." />;
  }

  

  const openAddModal = () => {
    setAddMethod("upi");
    setAddLabel("");
    setAddUpiId("");
    setAddAccountHolder("");
    setAddAccountNumber("");
    setAddIfsc("");
    setAddError("");
    setAddOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError("");

    if (addMethod === "upi" && !addUpiId.trim()) {
      setAddError("Enter your UPI ID.");
      return;
    }
    if (addMethod === "bank" && (!addAccountHolder.trim() || !addAccountNumber.trim() || !addIfsc.trim())) {
      setAddError("Fill in account holder name, account number and IFSC.");
      return;
    }

    setAddSubmitting(true);
    try {
      const payload = { method: addMethod, label: addLabel.trim() };
      if (addMethod === "upi") payload.upiId = addUpiId.trim();
      else {
        payload.accountHolderName = addAccountHolder.trim();
        payload.accountNumber = addAccountNumber.trim();
        payload.ifsc = addIfsc.trim();
      }

      const created = await addPayoutMethod(token, payload);
      mutatePayouts((prev) => [created, ...(prev || [])], false);
      mutatePayouts();
      setAddOpen(false);
    } catch (err) {
      setAddError(friendlyError(err));
    } finally {
      setAddSubmitting(false);
    }
  };

  const makeDefault = async (method) => {
    setActingId(method._id);
    try {
      await setDefaultPayoutMethod(token, method._id);
      mutatePayouts((prev) => prev?.map((m) => ({ ...m, isDefault: m._id === method._id })), false);
      mutatePayouts();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setActingId(null);
    }
  };

  const remove = async (method) => {
    setActingId(method._id);
    try {
      await deletePayoutMethod(token, method._id);
      mutatePayouts((prev) => prev?.filter((m) => m._id !== method._id), false);
      mutatePayouts();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="stack">
      <h1>Payment Methods</h1>

      {error && (
        <p className="notice-banner row-between">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { mutateDeposits(); mutatePayouts(); }}>
            Retry
          </button>
        </p>
      )}

      {loading ? (
        <Loading label="Loading payment methods..." />
      ) : (
        <>
          <div>
            <div className="section-title">
              <h2>Deposit To</h2>
            </div>
            {depositMethods.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon="💳"
                  title="No deposit destinations yet"
                  description="Once the admin adds one, you'll see where to send money here."
                />
              </div>
            ) : (
              <div className="stack">
                {depositMethods.map((m) => (
                  <div key={m._id} className="card payment-method-card">
                    <p className="payment-method-card__label">{m.label}</p>
                    {m.method === "upi" ? (
                      <p className="text-muted">UPI ID: {m.upiId}</p>
                    ) : (
                      <>
                        <p className="text-muted">A/C Holder: {m.accountHolderName}</p>
                        <p className="text-muted">A/C Number: {m.accountNumber}</p>
                        <p className="text-muted">IFSC: {m.ifsc}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="row-between section-title">
              <h2>Your Payout Methods</h2>
              <button className="btn btn-primary btn-sm" onClick={openAddModal}>
                <PlusIcon size={16} /> Add
              </button>
            </div>
            {payoutMethods.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon="🏧"
                  title="No saved payout methods"
                  description="Save your UPI or bank details here to reuse them on future withdrawals."
                />
              </div>
            ) : (
              <div className="stack">
                {payoutMethods.map((m) => (
                  <div key={m._id} className="card admin-row row-between">
                    <div>
                      {m.isDefault && <span className="badge badge-open">Default</span>}
                      <p className="admin-row__amount">{m.label || (m.method === "upi" ? "UPI" : "Bank Account")}</p>
                      <p className="text-muted">
                        {m.method === "upi" ? m.upiId : `${m.accountHolderName} · ${m.accountNumber}`}
                      </p>
                    </div>
                    <div className="row admin-row__actions">
                      {!m.isDefault && (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={actingId === m._id}
                          onClick={() => makeDefault(m)}
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actingId === m._id}
                        onClick={() => remove(m)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Modal isOpen={isAddOpen} onClose={() => setAddOpen(false)} title="Add Payment Method">
        <form className="stack" onSubmit={handleAddSubmit}>
          <div className="row wallet-modal__method">
            <button
              type="button"
              className={"btn btn-sm " + (addMethod === "upi" ? "btn-primary" : "btn-outline")}
              onClick={() => setAddMethod("upi")}
            >
              UPI
            </button>
            <button
              type="button"
              className={"btn btn-sm " + (addMethod === "bank" ? "btn-primary" : "btn-outline")}
              onClick={() => setAddMethod("bank")}
            >
              Bank Transfer
            </button>
          </div>

          <div className="field">
            <label htmlFor="pm-label">Label (optional)</label>
            <input
              id="pm-label"
              className="input"
              type="text"
              placeholder="e.g. Primary UPI"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              disabled={addSubmitting}
            />
          </div>

          {addMethod === "upi" ? (
            <div className="field">
              <label htmlFor="pm-upi">UPI ID</label>
              <input
                id="pm-upi"
                className="input"
                type="text"
                placeholder="yourname@upi"
                value={addUpiId}
                onChange={(e) => setAddUpiId(e.target.value)}
                disabled={addSubmitting}
              />
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="pm-holder">Account Holder Name</label>
                <input
                  id="pm-holder"
                  className="input"
                  type="text"
                  value={addAccountHolder}
                  onChange={(e) => setAddAccountHolder(e.target.value)}
                  disabled={addSubmitting}
                />
              </div>
              <div className="field">
                <label htmlFor="pm-account">Account Number</label>
                <input
                  id="pm-account"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  value={addAccountNumber}
                  onChange={(e) => setAddAccountNumber(e.target.value)}
                  disabled={addSubmitting}
                />
              </div>
              <div className="field">
                <label htmlFor="pm-ifsc">IFSC Code</label>
                <input
                  id="pm-ifsc"
                  className="input"
                  type="text"
                  value={addIfsc}
                  onChange={(e) => setAddIfsc(e.target.value.toUpperCase())}
                  disabled={addSubmitting}
                />
              </div>
            </>
          )}

          {addError && <p className="notice-banner">{addError}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={addSubmitting}>
            {addSubmitting ? "Saving..." : "Save Payment Method"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
