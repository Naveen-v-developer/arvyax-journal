const mongoose = require("mongoose");

const journalEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    ambience: {
      type: String,
      required: true,
      enum: ["forest", "ocean", "mountain", "desert", "meadow"],
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    analysis: {
      emotion: String,
      keywords: [String],
      summary: String,
      analyzedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

const JournalEntry = mongoose.model("JournalEntry", journalEntrySchema);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("   DB:  ✅ MongoDB Atlas connected");
  } catch (err) {
    console.error("   DB:  ❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = { connectDB, JournalEntry };