import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import mongoose from "mongoose";

import Medicine from "./models/Medicine.js";
import ScanHistory from "./models/ScanHistory.js";
import { DRUG_DATABASE } from "./seed.js";

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

function normalizeDetectedValue(value, { uppercase = false } = {}) {
  if (typeof value !== "string") {
    return "";
  }

  const normalizedValue = value.trim();
  if (!normalizedValue || normalizedValue.toUpperCase() === "UNKNOWN") {
    return "";
  }

  return uppercase ? normalizedValue.toUpperCase() : normalizedValue;
}

async function callPythonAnalyze({
  file,
  expectedCompounds = null,
  brandName = null,
  batchNumber = null,
  referenceLogo = "default_logo.png",
}) {
  const formData = new FormData();
  formData.append("image", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  if (expectedCompounds?.length) {
    const compoundsJson = JSON.stringify(expectedCompounds);
    formData.append("expected_compounds", compoundsJson);
    formData.append("expected_chemicals", compoundsJson);
  }

  if (brandName) {
    formData.append("brand_name", brandName);
  }

  if (batchNumber) {
    formData.append("batch_number", batchNumber);
  }

  formData.append("reference_logo", referenceLogo || "default_logo.png");

  const pythonResponse = await axios.post(
    `${PYTHON_SERVICE_URL}/api/analyze`,
    formData,
    {
      headers: formData.getHeaders(),
      timeout: 60000,
      maxContentLength: 50 * 1024 * 1024,
    }
  );

  return pythonResponse.data;
}

function buildUnifiedReport(report, { matchedMedicine = null, brandName = "", batchNumber = "", processingTimeMs = 0 }) {
  return {
    ...report,
    brandName: brandName || matchedMedicine?.brandName || "",
    batchNumber: batchNumber || matchedMedicine?.batchNumber || "UNKNOWN",
    processing_time_ms: processingTimeMs || report.processing_time_ms || 0,
    _truthLedgerMatch: matchedMedicine ? buildTruthLedgerMatch(matchedMedicine) : null,
  };
}

function buildUnrecognizedBrandReport(report, { brandName = "", batchNumber = "", processingTimeMs = 0 }) {
  return {
    ...report,
    verdict: report.rejection_reason ? report.verdict : "COUNTERFEIT",
    rejection_reason: report.rejection_reason || "Unrecognized Brand",
    brandName,
    batchNumber: batchNumber || "UNKNOWN",
    processing_time_ms: processingTimeMs || report.processing_time_ms || 0,
    compound_verification: {
      extracted_compounds: report.compound_verification?.extracted_compounds || [],
      expected_compounds: [],
      match: false,
      match_percentage: 0,
    },
    _truthLedgerMatch: null,
  };
}

async function logScanHistoryEntry({ report, req, processingTimeMs }) {
  try {
    await ScanHistory.create({
      batchNumber: report.batchNumber || report.extracted_text?.batch_number || "UNKNOWN",
      brandName: report.brandName || report.extracted_text?.brand_name || "",
      verdict: report.verdict,
      ssimScore: report.ssim?.score || 0,
      confidence: report.confidence || 0,
      extractedText: report.extracted_text?.raw_text || "",
      compoundMatch: report.compound_verification?.match || false,
      compoundMatchPercentage: report.compound_verification?.match_percentage || 0,
      rejectionReason: report.rejection_reason || null,
      processingTimeMs,
      ipAddress: req.ip || req.connection?.remoteAddress || "",
    });
    console.log("  Scan logged to history");
  } catch (logErr) {
    console.error("  Failed to log scan:", logErr.message);
  }
}

async function syncTruthLedgerSeedData() {
  console.log("Syncing Truth Ledger seed data with MongoDB...");

  let insertedCount = 0;
  let updatedCount = 0;

  for (const medicineRecord of DRUG_DATABASE) {
    const existingMedicine = await Medicine.findOne({
      batchNumber: medicineRecord.batchNumber,
    }).lean();

    const payload = {
      ...medicineRecord,
      isActive: true,
    };

    if (existingMedicine) {
      await Medicine.updateOne(
        { batchNumber: medicineRecord.batchNumber },
        { $set: payload }
      );
      updatedCount += 1;
    } else {
      await Medicine.create(payload);
      insertedCount += 1;
    }
  }

  console.log(
    `Truth Ledger sync complete. Inserted ${insertedCount} new medicines, updated ${updatedCount} existing medicines.`
  );
}

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "*"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/bmp"];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

app.get("/health", (req, res) => {
  res.json({
    status: "operational",
    service: "optipharma-gateway",
    version: "1.0.0",
    dbState: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

const analyzeScanRequest = async (req, res) => {
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    console.log(`\n${"-".repeat(50)}`);
    console.log("Scan request received");
    console.log(`  File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

    console.log(`  Discovery pass -> Python service at ${PYTHON_SERVICE_URL}`);
    const discoveryReport = await callPythonAnalyze({
      file: req.file,
      referenceLogo: "default_logo.png",
    });

    const extractedBrandName = normalizeDetectedValue(discoveryReport.extracted_text?.brand_name);
    const extractedBatchNumber = normalizeDetectedValue(discoveryReport.extracted_text?.batch_number, {
      uppercase: true,
    });

    console.log(`  AI detected brand: ${extractedBrandName || "UNKNOWN"}`);
    console.log(`  AI detected batch: ${extractedBatchNumber || "UNKNOWN"}`);

    const matchedMedicine = extractedBrandName
      ? await Medicine.findOne({
          brandName: new RegExp(`^${escapeRegex(extractedBrandName)}$`, "i"),
          isActive: true,
        }).sort({ updatedAt: -1 })
      : null;

    if (!matchedMedicine) {
      const unresolvedReport = buildUnrecognizedBrandReport(discoveryReport, {
        brandName: extractedBrandName,
        batchNumber: extractedBatchNumber,
        processingTimeMs: Date.now() - startTime,
      });

      console.log(`  Truth Ledger match: none for ${extractedBrandName || "UNKNOWN"}`);
      console.log(`  Verdict: ${unresolvedReport.verdict} | Confidence: ${unresolvedReport.confidence}%`);
      console.log(`  Total gateway time: ${unresolvedReport.processing_time_ms}ms`);
      console.log("-".repeat(50));

      await logScanHistoryEntry({
        report: unresolvedReport,
        req,
        processingTimeMs: unresolvedReport.processing_time_ms,
      });

      return res.json(unresolvedReport);
    }

    console.log(`  Truth Ledger match: ${matchedMedicine.brandName}`);
    console.log(`  Expected compounds: ${matchedMedicine.expectedCompounds.join(", ")}`);
    console.log("  Verification pass -> Python service with Truth Ledger context");

    const verificationReport = await callPythonAnalyze({
      file: req.file,
      expectedCompounds: matchedMedicine.expectedCompounds,
      brandName: matchedMedicine.brandName,
      batchNumber: extractedBatchNumber || matchedMedicine.batchNumber,
      referenceLogo: matchedMedicine.referenceLogoFilename || "default_logo.png",
    });

    const unifiedReport = buildUnifiedReport(verificationReport, {
      matchedMedicine,
      brandName: matchedMedicine.brandName,
      batchNumber:
        normalizeDetectedValue(verificationReport.extracted_text?.batch_number, {
          uppercase: true,
        }) ||
        extractedBatchNumber ||
        matchedMedicine.batchNumber,
      processingTimeMs: Date.now() - startTime,
    });

    console.log(`  Verdict: ${unifiedReport.verdict} | Confidence: ${unifiedReport.confidence}%`);
    console.log(`  Total gateway time: ${unifiedReport.processing_time_ms}ms`);
    console.log("-".repeat(50));

    await logScanHistoryEntry({
      report: unifiedReport,
      req,
      processingTimeMs: unifiedReport.processing_time_ms,
    });

    return res.json(unifiedReport);
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`  Error after ${totalTime}ms:`, err.message);

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
};

app.post("/api/scan", upload.single("image"), analyzeScanRequest);
app.post("/api/analyze", upload.single("image"), analyzeScanRequest);

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

app.get("/api/brands", async (req, res) => {
  try {
    const brands = await Medicine.distinct("brandName", { isActive: true });
    const sortedBrands = brands
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));

    res.json(sortedBrands);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch brands", details: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({
    service: "OptiPharma Gateway",
    version: "1.0.0",
    endpoints: {
      "POST /api/scan": "Upload medicine image for verification",
      "POST /api/analyze": "Upload medicine image for zero-click verification",
      "GET /api/history": "View scan history",
      "GET /api/medicines": "View registered medicines",
      "GET /api/brands": "View available medicine brands",
      "GET /health": "Health check",
    },
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB:", SAFE_MONGO_URI);
    await syncTruthLedgerSeedData();

    app.listen(PORT, () => {
      console.log(`\n${"=".repeat(50)}`);
      console.log(" OptiPharma Gateway");
      console.log(` Port: ${PORT}`);
      console.log(` Python Service: ${PYTHON_SERVICE_URL}`);
      console.log(` MongoDB: ${SAFE_MONGO_URI}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

startServer();
