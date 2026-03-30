/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  OptiPharma — Node.js Express Gateway Server                        ║
 * ║                                                                     ║
 * ║  The intelligent middleware between React frontend and Python       ║
 * ║  AI/CV microservice. Responsibilities:                              ║
 * ║                                                                     ║
 * ║  1. Accept image uploads from the frontend (multer)                 ║
 * ║  2. Look up expected compounds from MongoDB Truth Ledger            ║
 * ║  3. Forward image + compound data to Python FastAPI                 ║
 * ║  4. Log every scan result to ScanHistory                            ║
 * ║  5. Return structured threat report to frontend                     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import mongoose from "mongoose";

// Models
import Medicine from "./models/Medicine.js";
import ScanHistory from "./models/ScanHistory.js";

// ─────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/optipharma";
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
const SAFE_MONGO_URI = (() => {
  try {
    const parsed = new URL(MONGO_URI);
    const protocol = parsed.protocol || "mongodb:";
    const host = parsed.host || "unknown-host";
    const database = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";

    if (parsed.username) {
      return `${protocol}//${parsed.username}:***@${host}${database}`;
    }

    return `${protocol}//${host}${database}`;
  } catch {
    return "invalid-or-unparseable-uri";
  }
})();

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTruthLedgerMatch(medicine) {
  if (!medicine) {
    return null;
  }

  return {
    brandName: medicine.brandName,
    batchNumber: medicine.batchNumber,
    expectedCompounds: medicine.expectedCompounds,
    manufacturer: medicine.manufacturer,
    expiryDate: medicine.expiryDate,
  };
}

// ─────────────────────────────────────────────────────────────────
// Express App Setup
// ─────────────────────────────────────────────────────────────────

const app = express();

// CORS — allow frontend dev server
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "*"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// Multer — in-memory storage for uploaded images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

// ─────────────────────────────────────────────────────────────────
// MongoDB Connection
// ─────────────────────────────────────────────────────────────────

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✓ Connected to MongoDB:", SAFE_MONGO_URI))
  .catch((err) => console.error("✗ MongoDB connection failed:", err.message));

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

/**
 * Health Check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "operational",
    service: "optipharma-gateway",
    version: "1.0.0",
    dbState: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

/**
 * POST /api/scan — Main Scanning Endpoint
 *
 * Flow:
 *   1. Receive image upload from frontend
 *   2. (Optional) batch_number in body → look up expected compounds in MongoDB
 *   3. Forward image + expected compounds to Python AI/CV microservice
 *   4. Receive threat report → log to ScanHistory → return to frontend
 */
app.post("/api/scan", upload.single("image"), async (req, res) => {
  const startTime = Date.now();

  try {
    // ── Validate Upload ───────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    console.log(`\n${"━".repeat(50)}`);
    console.log(`📸 Scan request received`);
    console.log(`   File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

    // ── MongoDB Lookup — The Truth Ledger ─────────────────────
    let expectedCompounds = null;
    let referenceLogo = "default_logo.png";
    const batchHint = req.body.batch_number?.trim().toUpperCase() || null;
    const brandHint = req.body.brandName?.trim() || req.body.brand_name?.trim() || null;
    let matchedMedicine = null;

    if (batchHint) {
      console.log(`   Batch hint: ${batchHint}`);
      const medicine = await Medicine.findOne({
        batchNumber: batchHint.toUpperCase(),
        isActive: true,
      });

      if (medicine) {
        matchedMedicine = medicine;
        expectedCompounds = medicine.expectedCompounds;
        referenceLogo = medicine.referenceLogoFilename || "default_logo.png";
        console.log(`   ✓ Found in Truth Ledger: ${medicine.brandName}`);
        console.log(`   ✓ Expected: ${expectedCompounds.join(", ")}`);
      } else {
        console.log(`   ⚠ Batch ${batchHint} not found in Truth Ledger`);
      }
    } else {
      // No batch hint — try to find ANY matching medicine
      // The Python service will extract the batch via Gemini OCR
      console.log(`   ℹ No batch hint — Python service will extract via OCR`);
    }

    // ── Forward to Python AI/CV Microservice ──────────────────
    console.log(`   → Forwarding to Python service at ${PYTHON_SERVICE_URL}...`);

    // CHANGE 1:
    // If batch lookup did not resolve a ledger record, fall back to the
    // brand name supplied by the frontend payload.
    if (!matchedMedicine && brandHint) {
      console.log(`   Brand hint: ${brandHint}`);
      matchedMedicine = await Medicine.findOne({
        brandName: new RegExp(`^${escapeRegex(brandHint)}$`, "i"),
        isActive: true,
      }).sort({ updatedAt: -1 });

      if (matchedMedicine) {
        expectedCompounds = matchedMedicine.expectedCompounds;
        referenceLogo = matchedMedicine.referenceLogoFilename || "default_logo.png";
        console.log(`   Brand lookup resolved: ${matchedMedicine.brandName}`);
        console.log(`   Expected: ${expectedCompounds.join(", ")}`);
      } else {
        console.log(`   Brand ${brandHint} not found in Truth Ledger`);
      }
    }

    const formData = new FormData();
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    // Attach expected compounds from MongoDB (if found)
    if (expectedCompounds) {
      formData.append("expected_compounds", JSON.stringify(expectedCompounds));
      formData.append("expected_chemicals", JSON.stringify(expectedCompounds));
    }
    if (batchHint) {
      formData.append("batch_number", batchHint);
    } else if (matchedMedicine?.batchNumber) {
      formData.append("batch_number", matchedMedicine.batchNumber);
    }
    if (brandHint || matchedMedicine?.brandName) {
      formData.append("brand_name", matchedMedicine?.brandName || brandHint);
    }
    formData.append("reference_logo", referenceLogo);

    // Call the Python service
    const pythonResponse = await axios.post(
      `${PYTHON_SERVICE_URL}/api/analyze`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 60000, // 60s timeout for Gemini API calls
        maxContentLength: 50 * 1024 * 1024,
      }
    );

    const report = pythonResponse.data;

    if (matchedMedicine) {
      report._truthLedgerMatch = buildTruthLedgerMatch(matchedMedicine);
    }

    // ── Post-Processing: Lookup by extracted batch (if no hint) ──
    if (!expectedCompounds && report.extracted_text?.batch_number) {
      const extractedBatch = report.extracted_text.batch_number;
      console.log(`   → OCR extracted batch: ${extractedBatch}`);

      if (extractedBatch !== "UNKNOWN") {
        const medicine = await Medicine.findOne({
          batchNumber: extractedBatch.toUpperCase(),
          isActive: true,
        });

        if (medicine) {
          console.log(`   ✓ Post-OCR lookup found: ${medicine.brandName}`);
          // Note: In production, we'd re-run compound verification here.
          // For hackathon, we attach the data for frontend display.
          report._truthLedgerMatch = {
            brandName: medicine.brandName,
            expectedCompounds: medicine.expectedCompounds,
            manufacturer: medicine.manufacturer,
            expiryDate: medicine.expiryDate,
          };
        }
      }
    }

    // ── Log to Scan History ───────────────────────────────────
    try {
      await ScanHistory.create({
        batchNumber: report.extracted_text?.batch_number || batchHint || "UNKNOWN",
        brandName: report.extracted_text?.brand_name || "",
        verdict: report.verdict,
        ssimScore: report.ssim?.score || 0,
        confidence: report.confidence || 0,
        extractedText: report.extracted_text?.raw_text || "",
        compoundMatch: report.compound_verification?.match || false,
        compoundMatchPercentage: report.compound_verification?.match_percentage || 0,
        rejectionReason: report.rejection_reason || null,
        processingTimeMs: Date.now() - startTime,
        ipAddress: req.ip || req.connection?.remoteAddress || "",
      });
      console.log("   ✓ Scan logged to history");
    } catch (logErr) {
      console.error("   ⚠ Failed to log scan:", logErr.message);
    }

    // ── Return Report ─────────────────────────────────────────
    const totalTime = Date.now() - startTime;
    console.log(`   ✓ Verdict: ${report.verdict} | Confidence: ${report.confidence}%`);
    console.log(`   ✓ Total gateway time: ${totalTime}ms`);
    console.log("━".repeat(50));

    return res.json(report);
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`   ✗ Error after ${totalTime}ms:`, err.message);

    // Differentiate between Python service errors and local errors
    if (err.response) {
      return res.status(err.response.status).json({
        error: "AI service error",
        details: err.response.data,
      });
    }
    if (err.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "AI/CV microservice is unavailable",
        details: `Cannot connect to ${PYTHON_SERVICE_URL}. Is the Python service running?`,
      });
    }
    return res.status(500).json({ error: "Gateway error", details: err.message });
  }
});

/**
 * GET /api/history — Scan History for Analytics Dashboard
 * Returns the most recent scans, with optional filters.
 */
app.get("/api/history", async (req, res) => {
  try {
    const { limit = 50, verdict, batch } = req.query;

    const filter = {};
    if (verdict) filter.verdict = verdict.toUpperCase();
    if (batch) filter.batchNumber = { $regex: batch, $options: "i" };

    const scans = await ScanHistory.find(filter)
      .sort({ scannedAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      count: scans.length,
      scans,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history", details: err.message });
  }
});

/**
 * GET /api/medicines — List all medicines in the Truth Ledger
 */
app.get("/api/medicines", async (req, res) => {
  try {
    const medicines = await Medicine.find({ isActive: true })
      .sort({ brandName: 1 })
      .lean();

    res.json({ count: medicines.length, medicines });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch medicines", details: err.message });
  }
});

/**
 * Root endpoint
 */
app.get("/", (req, res) => {
  res.json({
    service: "OptiPharma Gateway",
    version: "1.0.0",
    endpoints: {
      "POST /api/scan": "Upload medicine image for verification",
      "GET /api/history": "View scan history",
      "GET /api/medicines": "View registered medicines",
      "GET /health": "Health check",
    },
  });
});

// ─────────────────────────────────────────────────────────────────
// Error Handler
// ─────────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

// ─────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n${"═".repeat(50)}`);
  console.log(` 🛡️  OptiPharma Gateway`);
  console.log(` 📡  Port: ${PORT}`);
  console.log(` 🐍  Python Service: ${PYTHON_SERVICE_URL}`);
  console.log(` 🗄️   MongoDB: ${SAFE_MONGO_URI}`);
  console.log("═".repeat(50));
});
