/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  PharmaShield — Medicine Schema (The Truth Ledger)              ║
 * ║  Stores verified pharmaceutical data: batch info, expected      ║
 * ║  chemical compounds, expiry dates, and reference logo paths.    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const mongoose = require("mongoose");

const MedicineSchema = new mongoose.Schema(
  {
    // Unique batch identifier (e.g., "BATCH-PCM-2026-001")
    batchNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    // Brand name of the medicine (e.g., "Dolo 650")
    brandName: {
      type: String,
      required: true,
      trim: true,
    },

    // Manufacturer (e.g., "Micro Labs Ltd")
    manufacturer: {
      type: String,
      required: true,
      trim: true,
    },

    // Expected chemical compounds — the golden truth
    expectedCompounds: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => v.length > 0,
        message: "At least one expected compound is required",
      },
    },

    // Expiry date of this batch
    expiryDate: {
      type: Date,
      required: true,
    },

    // Reference logo filename (stored in backend-python/reference_logos/)
    referenceLogoFilename: {
      type: String,
      default: "default_logo.png",
    },

    // Drug category for classification
    category: {
      type: String,
      enum: ["analgesic", "antibiotic", "antiviral", "cardiovascular", "other"],
      default: "other",
    },

    // Whether this batch is currently active/valid
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
  }
);

// Compound text index for search
MedicineSchema.index({ brandName: "text", manufacturer: "text" });

module.exports = mongoose.model("Medicine", MedicineSchema);
