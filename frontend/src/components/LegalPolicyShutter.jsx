import { useState } from "react";
import "./LegalPolicyShutter.css";

export default function LegalPolicyShutter({ defaultOpenSection = "terms" }) {
  const [openSections, setOpenSections] = useState({
    [defaultOpenSection]: true,
  });

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  return (
    <div className="policy-shutter-container">
      <div className="policy-shutter-title-main">Legal & Platform Policies</div>

      {/* 1. Terms & Conditions Shutter */}
      <div className={`shutter-item ${openSections.terms ? "is-open" : ""}`}>
        <button className="shutter-header" onClick={() => toggleSection("terms")}>
          <span className="shutter-title">📜 Terms & Conditions</span>
          <span className="shutter-icon">{openSections.terms ? "▲" : "▼"}</span>
        </button>
        <div className="shutter-body-wrapper">
          <div className="shutter-body-content">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using the <strong>ludo King adda .com</strong> mobile application and website, you accept and agree to be bound by the terms and provision of this agreement. Furthermore, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.
            </p>

            <h2>2. Eligibility</h2>
            <p>
              You must be at least 18 years of age to register an account and play for real money on ludo King adda .com. By using our services, you warrant that you are legally capable of entering into binding contracts and that you reside in a jurisdiction where real-money skill gaming is legally permitted (excluding restricted states like Assam, Odisha, Telangana, Nagaland, Andhra Pradesh, and Sikkim).
            </p>

            <h2>3. Fair Play and Anti-Fraud Policy</h2>
            <p>
              We strictly enforce a Fair Play policy to ensure all participants have an equal and untampered chance of winning.
            </p>
            <ul>
              <li>Collusion, chip dumping, or operating multiple accounts to manipulate game outcomes is strictly prohibited.</li>
              <li>Submitting fake screenshots or falsely declaring match results will result in an immediate account ban and forfeiture of all wallet funds.</li>
              <li>Use of emulators, hacks, mods, or third-party cheating software in Ludo King while playing our matches will trigger an immediate suspension.</li>
            </ul>

            <h2>4. Financial Transactions</h2>
            <p>
              Deposits are credited to your <strong>Deposit Chips</strong> balance. Winnings from matches are credited to your <strong>Winning Chips</strong> balance, which can be withdrawn. Withdrawals require successful KYC verification. ludo King adda .com reserves the right to withhold withdrawals if suspicious activity is detected.
            </p>

            <h2>5. Limitation of Liability</h2>
            <p>
              ludo King adda .com is an independent matchmaking platform and is not affiliated with or sponsored by Gametion Technologies or Ludo King™. We solely facilitate skill-based contests among our users. We shall not be held liable for any monetary losses or connectivity issues caused by third-party applications.
            </p>

            <div className="policy-note-box green-note">
              <strong>Agreement:</strong> Continued use of the platform signifies your complete understanding and acceptance of these Terms and Conditions.
            </div>
          </div>
        </div>
      </div>

      {/* 2. GST Policy Shutter */}
      <div className={`shutter-item ${openSections.gst ? "is-open" : ""}`}>
        <button className="shutter-header" onClick={() => toggleSection("gst")}>
          <span className="shutter-title">📄 GST Policy (28% GST & TDS)</span>
          <span className="shutter-icon">{openSections.gst ? "▲" : "▼"}</span>
        </button>
        <div className="shutter-body-wrapper">
          <div className="shutter-body-content">
            <h2>1. Applicability of GST</h2>
            <p>
              As per the latest regulations by the Government of India, a <strong>Goods and Services Tax (GST) of 28%</strong> is applicable on the initial deposit amount made by users on real-money gaming platforms. This means whenever you add cash to your <strong>ludo King adda .com</strong> wallet, GST laws are strictly adhered to.
            </p>

            <h2>2. How GST is Calculated</h2>
            <p>
              The 28% GST is calculated on the total amount you deposit.
            </p>
            <div className="policy-example-box">
              <p className="example-title">Example Calculation:</p>
              <ul>
                <li>You intend to add: <strong>₹100</strong></li>
                <li>GST Deducted (28% of Deposit): <strong>₹21.87</strong></li>
                <li>Usable Chips Added to Wallet: <strong>78.13 Chips</strong></li>
              </ul>
            </div>
            <p>
              Please note that exact calculation logic might involve absorbing the GST partially or entirely via promotional cashbacks as a gesture of goodwill. Always review the final amount shown on the deposit confirmation screen.
            </p>

            <h2>3. Winnings and TDS (Tax Deducted at Source)</h2>
            <p>
              Apart from GST on deposits, Income Tax rules mandate a <strong>30% TDS</strong> deduction on your Net Winnings at the time of withdrawal, or at the end of the financial year.
            </p>
            <ul>
              <li>Net Winnings = Total Withdrawals - Total Deposits.</li>
              <li>TDS is strictly deducted only when your withdrawals exceed your deposited amount (resulting in net positive winnings).</li>
              <li>You will be provided with TDS certificates for the deducted tax at the end of the fiscal year.</li>
            </ul>

            <h2>4. Commitment to Compliance</h2>
            <p>
              ludo King adda .com operates with complete transparency and in absolute compliance with Indian federal laws, taxation policies, and central government mandates.
            </p>

            <div className="policy-note-box yellow-note">
              <strong>Note:</strong> Taxation policies are subject to change based on governmental amendments. Our platform will dynamically adjust calculations to remain compliant.
            </div>
          </div>
        </div>
      </div>

      {/* 3. Privacy Policy Shutter */}
      <div className={`shutter-item ${openSections.privacy ? "is-open" : ""}`}>
        <button className="shutter-header" onClick={() => toggleSection("privacy")}>
          <span className="shutter-title">🔒 Privacy Policy</span>
          <span className="shutter-icon">{openSections.privacy ? "▲" : "▼"}</span>
        </button>
        <div className="shutter-body-wrapper">
          <div className="shutter-body-content">
            <h2>1. Introduction</h2>
            <p>
              Welcome to <strong>ludo King adda .com</strong>. We respect your privacy and are committed to protecting your personal data. This Privacy Policy will inform you as to how we look after your personal data when you visit our application and tell you about your privacy rights.
            </p>

            <h2>2. Data We Collect</h2>
            <p>
              We may collect, use, store and transfer different kinds of personal data about you including:
            </p>
            <ul>
              <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
              <li><strong>Contact Data:</strong> includes billing address, email address and telephone numbers.</li>
              <li><strong>Financial Data:</strong> includes bank account, UPI IDs, and payment card details for processing withdrawals and deposits.</li>
              <li><strong>Transaction Data:</strong> includes details about payments to and from you and other details of matches you have played.</li>
              <li><strong>Technical Data:</strong> includes internet protocol (IP) address, your login data, browser type and version.</li>
            </ul>

            <h2>3. How We Use Your Data</h2>
            <p>
              We will only use your personal data when the law allows us to, such as performing the contract (facilitating Ludo matches), legitimate business interests, and legal/KYC compliance.
            </p>

            <h2>4. Data Security</h2>
            <p>
              We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed.
            </p>

            <h2>5. Your Legal Rights</h2>
            <p>
              Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, or restriction of processing.
            </p>

            <div className="policy-note-box blue-note">
              <strong>Contact Us:</strong> If you have any questions about this Privacy Policy, please contact our support team through the app.
            </div>
          </div>
        </div>
      </div>

      {/* 4. Cancellation & Refund Policy Shutter */}
      <div className={`shutter-item ${openSections.refund ? "is-open" : ""}`}>
        <button className="shutter-header" onClick={() => toggleSection("refund")}>
          <span className="shutter-title">💰 Cancellation & Refund Policy</span>
          <span className="shutter-icon">{openSections.refund ? "▲" : "▼"}</span>
        </button>
        <div className="shutter-body-wrapper">
          <div className="shutter-body-content">
            <h2>1. General Policy</h2>
            <p>
              At <strong>ludo King adda .com</strong>, we strive to ensure a fair and transparent gaming environment. All transactions and matches played on our platform are final. Due to the real-time nature of multiplayer gaming, we generally do not offer refunds once a match has commenced or entry fees have been deducted.
            </p>

            <h2>2. Cancellation of Matches</h2>
            <p>
              You may cancel a match before it begins under the following conditions:
            </p>
            <ul>
              <li>If the opponent fails to join the room within a reasonable timeframe.</li>
              <li>If an invalid room code is provided by the room creator.</li>
              <li>If both players mutually agree to cancel the match before any gameplay has occurred.</li>
            </ul>
            <p>
              In the event of a valid cancellation, your entry fee will be fully refunded to your ludo King adda .com wallet automatically.
            </p>

            <h2>3. Disputes and Disconnections</h2>
            <p>
              If a dispute arises during a match (e.g., conflicting result submissions or app crashes), the match goes into a <strong>Disputed</strong> state. Our administration team will manually review the submitted screenshot proofs.
            </p>

            <h2>4. Deposit Refunds</h2>
            <p>
              Money deposited into your ludo King adda .com wallet is strictly for gameplay. We do not process refunds back to your original payment method for unused wallet balances. You may withdraw your <strong>Winning Chips</strong> at any time subject to minimum withdrawal limits and KYC verification.
            </p>

            <h2>5. Technical Errors</h2>
            <p>
              In the rare event that a transaction fails but money is deducted from your bank account, the amount is usually reversed by your bank within 5-7 business days.
            </p>

            <div className="policy-note-box red-note">
              <strong>Important:</strong> Always capture and upload clear, unedited screenshots of your Ludo King victories to ensure seamless dispute resolutions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
