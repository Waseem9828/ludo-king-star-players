const mongoose = require('mongoose');

const uri = "mongodb+srv://khalilah64780_db_user:yhNqJOBHmam6D7Ih@cluster0.x3c0ftg.mongodb.net/ludokingadda?retryWrites=true&w=majority";

console.log("Connecting to MongoDB Atlas...");
mongoose.connect(uri)
  .then(() => {
    console.log("SUCCESS: Connected to MongoDB Atlas!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("ERROR: Failed to connect to MongoDB Atlas:", err.message);
    process.exit(1);
  });
