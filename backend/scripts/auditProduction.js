import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Match, { MATCH_STATUS } from "../models/Match.js";
import Transaction, { TRANSACTION_TYPE } from "../models/Transaction.js";
import Withdrawal from "../models/Withdrawal.js";
import Kyc from "../models/Kyc.js";
import PaymentOrder from "../models/PaymentOrder.js";
import Notification from "../models/Notification.js";
import { getOrCreateWallet, creditCoins, deductCoins, debitWinningCoins } from "../utils/coinLedger.js";
import { connectDB } from "../config/db.js";

async function runProductionAudit() {
  console.log("=================================================");
  console.log("🚀 STARTING AUTOMATED PRODUCTION READINESS AUDIT");
  console.log("=================================================\n");

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function assert(name, condition, details = "") {
    if (condition) {
      results.passed++;
      results.tests.push({ name, status: "PASSED", details });
      console.log(`✅ [PASS] ${name}`);
    } else {
      results.failed++;
      results.tests.push({ name, status: "FAILED", details });
      console.error(`❌ [FAIL] ${name}: ${details}`);
    }
  }

  // 1. Database Connection & Environment
  console.log("\n--- 1. Environment & Database Checks ---");
  assert("JWT_SECRET is set", Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 8));
  
  await connectDB();
  assert("MongoDB Connected", mongoose.connection.readyState === 1);

  // 2. Schema Indexes Audit
  console.log("\n--- 2. Database Indexes & Query Optimizations ---");
  const withdrawalIndexes = Withdrawal.schema.indexes();
  const hasPendingWithdrawalUnique = withdrawalIndexes.some(
    ([idx, opt]) => idx.user === 1 && opt?.unique === true && opt?.partialFilterExpression?.status === "pending"
  );
  assert("Withdrawal unique pending partial index exists", hasPendingWithdrawalUnique);

  const kycIndexes = Kyc.schema.indexes();
  const hasKycAadhaarIndex = kycIndexes.some(([idx]) => idx.aadhaarNumber === 1 && idx.status === 1);
  assert("Kyc compound index { aadhaarNumber: 1, status: 1 } exists", hasKycAadhaarIndex);

  const txIndexes = Transaction.schema.indexes();
  const hasTxTypeIndex = txIndexes.some(([idx]) => idx.type === 1);
  assert("Transaction type compound index exists", hasTxTypeIndex);

  const paymentIndexes = PaymentOrder.schema.indexes();
  const hasPaymentStatusIndex = paymentIndexes.some(([idx]) => idx.status === 1);
  assert("PaymentOrder status compound index exists", hasPaymentStatusIndex);

  // 3. Wallet Ledger Concurrency & Idempotency Audit
  console.log("\n--- 3. Wallet Ledger & Concurrency Stress Test ---");
  const testPhone = `99999${Math.floor(10000 + Math.random() * 90000)}`;
  const testUser = await User.create({
    name: "Audit Test User",
    phone: testPhone,
    role: "user",
    status: "active",
  });

  const wallet = await getOrCreateWallet(testUser._id);
  assert("Wallet created with 0 balances", wallet.depositCoins === 0 && wallet.winningCoins === 0);

  // Test credit with idempotency
  const refKey = `audit_test_ref_${Date.now()}`;
  await creditCoins(testUser._id, 500, {
    type: TRANSACTION_TYPE.WALLET_TOPUP,
    note: "Audit Topup",
    reference: refKey,
  });

  const walletAfterCredit = await Wallet.findOne({ user: testUser._id });
  assert("Credit added 500 deposit coins", walletAfterCredit.depositCoins === 500);

  // Re-run with SAME reference — must NOT credit twice!
  await creditCoins(testUser._id, 500, {
    type: TRANSACTION_TYPE.WALLET_TOPUP,
    note: "Duplicate Topup Attempt",
    reference: refKey,
  });

  const walletAfterDuplicate = await Wallet.findOne({ user: testUser._id });
  assert("Idempotency prevented duplicate credit", walletAfterDuplicate.depositCoins === 500);

  // Test spend
  const deducted = await deductCoins(testUser._id, 200, {
    type: TRANSACTION_TYPE.BATTLE_ENTRY,
    note: "Audit Battle Entry",
  });
  assert("Deduct reduced coins to 300", deducted.depositCoins === 300);

  // Test over-spend attempt (must fail safely)
  const overspendResult = await deductCoins(testUser._id, 5000, {
    type: TRANSACTION_TYPE.BATTLE_ENTRY,
    note: "Illegal Overspend",
  });
  assert("Overspend correctly blocked (returns null)", overspendResult === null);

  // 4. Withdrawal Concurrency & Double-Spend Test
  console.log("\n--- 4. Withdrawal Concurrency & Constraint Test ---");
  // Give winning coins
  await creditCoins(testUser._id, 1000, {
    type: TRANSACTION_TYPE.BATTLE_PRIZE,
    note: "Prize",
    reference: `prize_test_${Date.now()}`,
  });

  // Create first pending withdrawal
  const w1 = await Withdrawal.create({
    user: testUser._id,
    amount: 500,
    payoutMethod: "upi",
    payoutDetails: { upiId: "test@upi" },
    status: "pending",
  });
  assert("First pending withdrawal created successfully", Boolean(w1._id));

  // Attempt second simultaneous pending withdrawal — partial unique index must reject with E11000
  let duplicateRejected = false;
  try {
    await Withdrawal.create({
      user: testUser._id,
      amount: 500,
      payoutMethod: "upi",
      payoutDetails: { upiId: "test@upi" },
      status: "pending",
    });
  } catch (err) {
    duplicateRejected = err.code === 11000;
  }
  assert("Database partial unique index strictly blocks multiple pending withdrawals", duplicateRejected);

  // 5. Anti-NoSQL Injection Sanitizer Test
  console.log("\n--- 5. Anti-NoSQL Injection Middleware Test ---");
  const { mongoSanitize } = await import("../middleware/mongoSanitize.js");
  const maliciousReq = {
    body: {
      phone: { $gt: "" },
      password: "secret",
      nested: { $where: "sleep(5000)", normalField: 123 },
      "dotted.key": "injected",
    },
    query: {
      user: { $ne: null },
    },
  };
  const mockRes = {};
  let nextCalled = false;
  mongoSanitize(maliciousReq, mockRes, () => {
    nextCalled = true;
  });

  const bodySafe =
    !maliciousReq.body.phone?.$gt &&
    !maliciousReq.body.nested?.$where &&
    maliciousReq.body.nested?.normalField === 123 &&
    !("dotted.key" in maliciousReq.body) &&
    !maliciousReq.query.user?.$ne;

  assert("NoSQL operator injection ($gt, $where, $ne, dotted keys) stripped cleanly", bodySafe && nextCalled);

  // 6. Test Cleanup
  console.log("\n--- 6. Test Cleanup ---");
  await Withdrawal.deleteMany({ user: testUser._id });
  await Transaction.deleteMany({ user: testUser._id });
  await Wallet.deleteOne({ user: testUser._id });
  await User.deleteOne({ _id: testUser._id });
  console.log("🧹 Test user and transactions cleaned up.");

  // Summary
  console.log("\n=================================================");
  console.log(`AUDIT RESULTS: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log("=================================================");

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runProductionAudit().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
