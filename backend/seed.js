import "dotenv/config";
import mongoose from "mongoose";
import Medicine from "./models/Medicine.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pharmashield";

const SEED_DATA = [
  {
    batchNumber: "BATCH-PCM-2026-001",
    brandName: "Dolo 650",
    manufacturer: "Micro Labs Ltd",
    expectedCompounds: ["Paracetamol 650mg"],
    expiryDate: new Date("2027-06-30"),
    referenceLogoFilename: "default_logo.png",
    category: "analgesic",
  },
  {
    batchNumber: "BATCH-AMX-2026-042",
    brandName: "Amoxil 500",
    manufacturer: "GSK Pharmaceuticals",
    expectedCompounds: ["Amoxicillin Trihydrate 500mg", "Clavulanic Acid 125mg"],
    expiryDate: new Date("2027-03-15"),
    referenceLogoFilename: "default_logo.png",
    category: "antibiotic",
  },
  {
    batchNumber: "BATCH-AZT-2026-118",
    brandName: "Azithral 500",
    manufacturer: "Alembic Pharmaceuticals",
    expectedCompounds: ["Azithromycin Dihydrate 500mg"],
    expiryDate: new Date("2027-09-01"),
    referenceLogoFilename: "default_logo.png",
    category: "antibiotic",
  },
  {
    batchNumber: "BATCH-CPN-2026-205",
    brandName: "Calpol 500",
    manufacturer: "GlaxoSmithKline",
    expectedCompounds: ["Paracetamol 500mg", "Caffeine 65mg"],
    expiryDate: new Date("2027-12-31"),
    referenceLogoFilename: "default_logo.png",
    category: "analgesic",
  },
  {
    batchNumber: "BATCH-MTF-2026-067",
    brandName: "Glycomet 500",
    manufacturer: "USV Pvt Ltd",
    expectedCompounds: ["Metformin Hydrochloride 500mg"],
    expiryDate: new Date("2027-08-20"),
    referenceLogoFilename: "default_logo.png",
    category: "cardiovascular",
  },
  {
    batchNumber: "BATCH-IBP-2026-300",
    brandName: "Brufen 400",
    manufacturer: "Abbott India Ltd",
    expectedCompounds: ["Ibuprofen 400mg"],
    expiryDate: new Date("2027-04-10"),
    referenceLogoFilename: "default_logo.png",
    category: "analgesic",
  },
  {
    batchNumber: "BATCH-CIP-2026-089",
    brandName: "Ciplox 500",
    manufacturer: "Cipla Ltd",
    expectedCompounds: ["Ciprofloxacin Hydrochloride 500mg"],
    expiryDate: new Date("2027-07-25"),
    referenceLogoFilename: "default_logo.png",
    category: "antibiotic",
  },
  {
    batchNumber: "BATCH-ATV-2026-155",
    brandName: "Atorva 20",
    manufacturer: "Zydus Lifesciences",
    expectedCompounds: ["Atorvastatin Calcium 20mg"],
    expiryDate: new Date("2027-11-15"),
    referenceLogoFilename: "default_logo.png",
    category: "cardiovascular",
  },
];

// ─────────────────────────────────────────────────────────────────
// Seed Execution
// ─────────────────────────────────────────────────────────────────

async function seed() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB\n");

    // Clear existing data
    const deleted = await Medicine.deleteMany({});
    console.log(`🗑  Cleared ${deleted.deletedCount} existing medicines\n`);

    // Insert seed data
    const inserted = await Medicine.insertMany(SEED_DATA);
    console.log(`✓ Seeded ${inserted.length} medicines into the Truth Ledger:\n`);

    // Pretty print what was inserted
    inserted.forEach((med, i) => {
      console.log(`  ${i + 1}. [${med.batchNumber}] ${med.brandName}`);
      console.log(`     └─ ${med.expectedCompounds.join(", ")}`);
      console.log(`     └─ Manufacturer: ${med.manufacturer}`);
      console.log(`     └─ Expiry: ${med.expiryDate.toISOString().split("T")[0]}\n`);
    });

    console.log("━".repeat(50));
    console.log("✅ Database seeding complete!");
    console.log("━".repeat(50));
  } catch (err) {
    console.error("✗ Seeding failed:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB.");
  }
}

seed();
