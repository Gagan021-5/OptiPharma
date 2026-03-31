import { useState } from 'react';
import Header from './components/Header';
import Scanner from './components/Scanner';
import ThreatDashboard from './components/ThreatDashboard';
import ThreatMap from './components/ThreatMap';

function App() {
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScanComplete = (result) => {
    setScanResult(result);
    setIsScanning(false);
  };

  const handleNewScan = () => {
    setScanResult(null);
    setIsScanning(false);
  };

  const navItems = scanResult
    ? [
        { label: 'Overview', href: '#results-overview' },
        { label: 'Metrics', href: '#results-metrics' },
        { label: 'Session', href: '#results-session' },
        { label: 'Radar', href: '#god-view-radar' },
      ]
    : [
        { label: 'Workspace', href: '#scanner-workspace' },
        { label: 'Pipeline', href: '#scanner-workflow' },
        { label: 'Guidance', href: '#scanner-tips' },
        { label: 'Radar', href: '#god-view-radar' },
      ];

  return (
    <div className="app-shell bg-pharma-slate-900 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="absolute right-[-8rem] top-1/3 h-[22rem] w-[22rem] rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-6rem] h-[24rem] w-[24rem] rounded-full bg-sky-500/8 blur-3xl" />
      </div>

      <Header
        isScanning={isScanning}
        scanResult={scanResult}
        navItems={navItems}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-8 lg:px-8 lg:pt-10">
        <div className="space-y-6 sm:space-y-8">
          {scanResult ? (
            <ThreatDashboard
              report={scanResult}
              onNewScan={handleNewScan}
            />
          ) : (
            <Scanner
              onScanComplete={handleScanComplete}
              isScanning={isScanning}
              setIsScanning={setIsScanning}
            />
          )}

          <ThreatMap />
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/6 bg-pharma-slate-900/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-center text-xs text-pharma-slate-500 sm:px-6 sm:py-5 lg:px-8 lg:flex-row lg:items-center lg:justify-between lg:text-left">
          <p className="font-mono uppercase tracking-[0.24em] text-pharma-slate-500/90">
            OptiPharma v1.0.0
          </p>
          <p>Operational platform for counterfeit medicine verification.</p>
          <p className="text-pharma-slate-600">Codecure Hackathon · Team OptiPharma</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
