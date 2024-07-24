const express = require("express");
const { authMiddleware } = require("../middleware");
const { Account, User } = require("../db");
const { default: mongoose } = require('mongoose');

const router = express.Router();

router.get("/balance", authMiddleware, async (req, res) => {
  const account = await Account.findOne({
    userId: req.userId,
  });

  res.json({
    balance: account.balance,
  });
});

router.post("/transfer", authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  const { amount, to } = req.body;
  try {
    // Find sender and recipient accounts
    const accountS = await Account.findOne({ userId: req.userId }).session(
      session
    );

    if (!accountS || accountS.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    const accountR = await Account.findOne({ userId: to }).session(session);

    if (!accountR) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Invalid account",
      });
    }

    await Account.updateOne(
      { userId: req.userId },
      { $inc: { balance: -amount } }
    ).session(session);
    await Account.updateOne(
      { userId: to },
      { $inc: { balance: amount } }
    ).session(session);

    // Commit the transaction
    await session.commitTransaction();

    res.json({
      message: "Transfer successful",
    });
  } catch (error) {
    // Handle errors and abort the transaction
    await session.abortTransaction();
    console.error("Transaction failed:", error);
    res.status(500).send("Transaction failed. Please try again later.");
  } finally {
    // End the session
    session.endSession();
  }
});

module.exports = router;
