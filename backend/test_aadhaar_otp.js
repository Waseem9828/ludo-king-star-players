import dotenv from "dotenv";
import dns from "node:dns";
import fetch from "node-fetch";
import { getProxyAgent } from "./utils/proxyAgent.js";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

dotenv.config();

async function testAadhaarOtp() {
  const clientId = process.env.IMB_CLIENT_ID;
  const clientSecret = process.env.IMB_CLIENT_SECRET;

  console.log("Using IMB_CLIENT_ID:", clientId ? `${clientId.slice(0, 10)}...` : "NOT SET");
  console.log("Using IMB_CLIENT_SECRET:", clientSecret ? `${clientSecret.slice(0, 10)}...` : "NOT SET");

  const agent = getProxyAgent();
  console.log("Using Proxy Agent:", agent ? "YES (Fixie Proxy active)" : "NO");

  // Test dummy Aadhaar number (e.g. 12-digit format)
  const testAadhaar = "999999999999"; 

  const url = "https://secure.imbpayment.in/api/v1/aadhaar/send-otp";

  console.log(`Sending test Aadhaar OTP request to ${url}...`);

  const fetchOptions = {
    method: "POST",
    headers: {
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ aadhaar_number: testAadhaar }),
  };

  try {
    console.log("Sending direct request to IMB API (no proxy)...");
    const res = await fetch(url, fetchOptions);
    console.log("Direct HTTP Status Code:", res.status);
    const data = await res.json();
    console.log("Direct Response JSON:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Direct Fetch Exception:", err);
  }
}

testAadhaarOtp();
