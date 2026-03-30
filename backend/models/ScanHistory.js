/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  OptiPharma — Scan History Schema                               ║
 * ║  Logs every scan for analytics, audit trails, and compliance.   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import mongoose from "mongoose";

const ScanHistorySchema = new mongoose.Schema(
  {
  // Batch number scanned (may be "UNKNOWN" if OCR fails)
  batchNumber: {
    type: String,
    default: "UNKNOWN",
    trim: true,
    index: true,
  },

  // Brand name detected (if available)
  brandName: {
    type: String,
    default: "",
  },

  // Final verdict from the pipeline
  verdict: {
    type: String,
    enum: ["VERIFIED", "COUNTERFEIT", "INCONCLUSIVE"],
    required: true,
    index: true,
  },

  // SSIM score from Tier 1
  ssimScore: {
    type: Number,
    min: 0,
    max: 1,
    required: true,
  },

  // Overall confidence percentage
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },

  // Raw extracted text from Gemini OCR
  extractedText: {
    type: String,
    default: "",
  },

  // Compound match result
  compoundMatch: {
    type: Boolean,
    default: false,
  },

  // Compound match percentage
  compoundMatchPercentage: {
    type: Number,
    default: 0,
  },

  // Rejection reason (if counterfeit/inconclusive)
  rejectionReason: {
    type: String,
    default: null,
  },

  // Processing time in milliseconds
  processingTimeMs: {
    type: Number,
    default: 0,
  },

  // Client IP address (for geo-analytics)
  ipAddress: {
    type: String,
    default: "",
  },

  // Timestamp — when the scan was performed
  scannedAt: {
    type: Date,
    default: Date.now,
  },
  },
  {
    collection: "scanhistory",
  }
);

// TTL index: auto-delete scan logs older than 90 days (compliance)
ScanHistorySchema.index({ scannedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const ScanHistory = mongoose.model("ScanHistory", ScanHistorySchema);

export default ScanHistory;
