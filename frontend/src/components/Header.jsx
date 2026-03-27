/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  OptiPharma — Header Component                      ║
 * ║  Clinical top bar with branding + live status       ║
 * ╚══════════════════════════════════════════════════════╝
 */

import { motion } from 'framer-motion';

export default function Header({ isScanning, scanResult }) {
  const getStatusText = () => {
    if (isScanning) return 'ANALYZING...';
    if (scanResult?.verdict === 'VERIFIED') return 'VERIFIED';
    if (scanResult?.verdict === 'COUNTERFEIT') return 'THREAT DETECTED';
    if (scanResult) return 'SCAN COMPLETE';
    return 'READY';
  };

  const getStatusColor = () => {
    if (isScanning) return 'text-cyan-400';
    if (scanResult?.verdict === 'VERIFIED') return 'text-emerald-400';
    if (scanResult?.verdict === 'COUNTERFEIT') return 'text-red-400';
    return 'text-cyan-400';
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-pharma-slate-900/80 backdrop-blur-xl">
      <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        
        {/* ─── Logo / Branding ──────────────────────── */}
        <div className="flex items-center gap-3">
          {/* Shield Icon */}
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            {/* Pulse ring when scanning */}
            {isScanning && (
              <motion.div
                className="absolute inset-0 rounded-xl border-2 border-cyan-400"
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Opti<span className="text-cyan-400">Pharma</span>
            </h1>
            <p className="text-[10px] font-mono text-pharma-slate-500 uppercase tracking-widest">
              Counterfeit Detection System
            </p>
          </div>
        </div>

        {/* ─── Status Indicator ─────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className={`status-dot ${!isScanning ? 'online' : ''} ${isScanning ? 'bg-cyan-400 animate-pulse' : ''}`} />
            <span className={`text-xs font-mono font-medium tracking-wider ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
          
          <div className="text-right">
            <p className="text-[10px] font-mono text-pharma-slate-500">v1.0.0</p>
            <p className="text-[10px] font-mono text-pharma-slate-600">HYBRID CV+LLM</p>
          </div>
        </div>
      </div>

      {/* Scanning progress bar */}
      {isScanning && (
        <motion.div
          className="h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </header>
  );
}
