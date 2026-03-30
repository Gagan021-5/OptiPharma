import "dotenv/config";
import mongoose from "mongoose";
import Medicine from "./models/Medicine.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/optipharma";

// The "National Truth Ledger" Mock Data
const DRUG_DATABASE = [
  {
    batchNumber: "UNKNOWN", // Set to unknown to simulate a damaged/unreadable batch number on the foil
    brandName: "PAN 40",
    manufacturer: "Alkem Laboratories",
    expectedCompounds: ["Pantoprazole Sodium"], 
    expiryDate: new Date("2026-12-31"),
    referenceLogoFilename: "pan40_logo.png",
    category: "other",
  },
  {
    batchNumber: "MGL-9932",
    brandName: "Dolo 650",
    manufacturer: "Micro Labs Ltd",
    expectedCompounds: ["Paracetamol 650mg"],
    expiryDate: new Date("2027-08-15"),
    referenceLogoFilename: "dolo_logo.png",
    category: "analgesic",
  },
  {
    batchNumber: "AUG-2024A",
    brandName: "Augmentin 625 Duo",
    manufacturer: "GSK",
    expectedCompounds: ["Amoxicillin 500mg", "Clavulanic Acid 125mg"],
    expiryDate: new Date("2026-10-01"),
    referenceLogoFilename: "augmentin_logo.png",
    category: "antibiotic",
  },
  {
    batchNumber: "ALG-4411",
    brandName: "Allegra 120",
    manufacturer: "Sanofi India",
    expectedCompounds: ["Fexofenadine Hydrochloride 120mg"],
    expiryDate: new Date("2028-01-20"),
    referenceLogoFilename: "allegra_logo.png",
    category: "other",
  },
  {
    batchNumber: "GLY-776",
    brandName: "Glycomet-GP 1",
    manufacturer: "USV Private Limited",
    expectedCompounds: ["Glimepiride 1mg", "Metformin Hydrochloride 500mg"],
    expiryDate: new Date("2026-05-30"),
    referenceLogoFilename: "glycomet_logo.png",
    category: "other",
  },
  {
    // CHANGE:
    // Keep the dedicated OptiCillin demo record in the same seed set so the
    // frontend brandName fallback can always resolve a known Truth Ledger hit.
    batchNumber: "OPT-8821",
    brandName: "OptiCillin",
    manufacturer: "OptiPharma Labs",
    expectedCompounds: ["Amoxicillin 500mg", "Clavulanate 125mg"],
    expiryDate: new Date("2027-12-31"),
    referenceLogoFilename: "default_logo.png",
    category: "antibiotic",
  }
];

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.\n");

    console.log("Wiping old test data...");
    await Medicine.deleteMany({}); // Clears the database to prevent duplicates

    console.log("Seeding National Truth Ledger with random sampling...");
    
    // Insert all 5 medicines into the database
    await Medicine.insertMany(DRUG_DATABASE);

    console.log(`\n✅ Successfully seeded ${DRUG_DATABASE.length} pharmaceutical records!`);
    console.log("Your OptiPharma system is now ready for random live-demo testing.\n");

  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

seed();
