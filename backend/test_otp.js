import dotenv from "dotenv";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

dotenv.config();

const API_KING_SEND_URL = "https://api.api-king.com/api/v1/otp/send";

async function testOtp() {
  const apiKey = process.env.API_KING_KEY;
  console.log("Using API_KING_KEY:", apiKey ? `${apiKey.slice(0, 8)}...` : "NOT FOUND");

  const phone = "9828786246";
  const otp = "123456";

  console.log(`Testing OTP SMS send to ${phone} with code ${otp}...`);

  try {
    const res = await fetch(API_KING_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ number: phone, otp, route: "sms" }),
    });

    console.log("HTTP Status Code:", res.status);
    const responseText = await res.text();
    console.log("Raw Response:", responseText);
  } catch (err) {
    console.error("Fetch Exception:", err);
  }
}

testOtp();
