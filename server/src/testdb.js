require("dotenv").config();
const mongoose = require("mongoose");

async function test() {
  try {
    console.log("Connecting...");

    await mongoose.connect("");

    console.log("MongoDB connected successfully!");

    await mongoose.disconnect();
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error);
  }
}

test();