const http = require("http");

const data = JSON.stringify({
  order_id: "ord_test_123",
  status: "SUCCESS"
});

const req = http.request(
  "http://localhost:5000/api/payment/callback",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      console.log("Status:", res.statusCode);
      console.log("Body:", body);
    });
  }
);

req.on("error", (e) => console.error(e));
req.write(data);
req.end();
