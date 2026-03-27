/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  PharmaShield — App Shell                           ║
 * ║  Root layout with Header + Scanner → Dashboard flow ║
 * ╚══════════════════════════════════════════════════════╝
 */

import { useState } from 'react';
import Header from './components/Header';
import Scanner from './components/Scanner';
import ThreatDashboard from './components/ThreatDashboard';

function App() {
  // Scan result state — flows from Scanner → ThreatDashboard
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  /** Called when Scanner completes analysis and receives a ThreatReport */
  const handleScanComplete = (result) => {
    setScanResult(result);
    setIsScanning(false);
  };

  /** Reset to scanner view */
  const handleNewScan = () => {
    setScanResult(null);
    setIsScanning(false);
  };

  return (
    <div className="min-h-screen bg-pharma-slate-900 flex flex-col">
      {/* ─── Header ──────────────────────────────────────── */}
      <Header isScanning={isScanning} scanResult={scanResult} />

      {/* ─── Main Content ────────────────────────────────── */}
      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {scanResult ? (
          /* ─── Threat Dashboard (post-scan) ──────────── */
          <ThreatDashboard
            report={scanResult}
            onNewScan={handleNewScan}
          />
        ) : (
          /* ─── Scanner (pre-scan) ────────────────────── */
          <Scanner
            onScanComplete={handleScanComplete}
            isScanning={isScanning}
            setIsScanning={setIsScanning}
          />
        )}
      </main>

      {/* ─── Footer ──────────────────────────────────────── */}
      <footer className="text-center py-4 text-pharma-slate-500 text-xs font-mono border-t border-white/5">
        <p>PharmaShield v1.0.0 — Hybrid CV + LLM Pipeline</p>
        <p className="mt-1 opacity-60">Codecure Hackathon · Team OptiPharma</p>
      </footer>
    </div>
  );
}

export default App;
