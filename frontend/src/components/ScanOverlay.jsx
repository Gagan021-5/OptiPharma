/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  PharmaShield — Scan Overlay Component                      ║
 * ║  Animated scanner frame with CSS scan-line, corner brackets,║
 * ║  and pulse ring effect.                                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { motion } from 'framer-motion';

export default function ScanOverlay({ isActive }) {
  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* ─── Scanning Line ─────────────────────────── */}
      <div className="scan-line" />

      {/* ─── Corner Brackets ───────────────────────── */}
      <motion.div
        className="scanner-corner top-left"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      />
      <motion.div
        className="scanner-corner top-right"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      />
      <motion.div
        className="scanner-corner bottom-left"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
      />
      <motion.div
        className="scanner-corner bottom-right"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
      />

      {/* ─── Center Reticle ────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-20 h-20 rounded-full border border-cyan-400/30"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-10 h-10 rounded-full border border-cyan-400/50"
          animate={{ 
            scale: [1, 0.8, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
        />
        {/* Crosshair */}
        <div className="absolute w-6 h-[1px] bg-cyan-400/40" />
        <div className="absolute h-6 w-[1px] bg-cyan-400/40" />
      </div>

      {/* ─── Status Text ──────────────────────────── */}
      <motion.div
        className="absolute bottom-6 left-0 right-0 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-xs font-mono text-cyan-400 tracking-widest uppercase">
          Analyzing Medicine Strip
        </p>
        <div className="flex items-center justify-center gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-cyan-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>

      {/* ─── Vignette overlay ─────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-b from-pharma-slate-900/30 via-transparent to-pharma-slate-900/30" />
    </div>
  );
}
