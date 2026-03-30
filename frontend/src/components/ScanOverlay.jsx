import { motion } from 'framer-motion';

export default function ScanOverlay({ isActive }) {
  if (!isActive) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="scan-line" />

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

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="h-16 w-16 rounded-full border border-cyan-400/30 sm:h-20 sm:w-20"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute h-8 w-8 rounded-full border border-cyan-400/50 sm:h-10 sm:w-10"
          animate={{ scale: [1, 0.8, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
        />
        <div className="absolute h-[1px] w-6 bg-cyan-400/40" />
        <div className="absolute h-6 w-[1px] bg-cyan-400/40" />
      </div>

      <motion.div
        className="absolute bottom-4 left-0 right-0 px-4 text-center sm:bottom-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-cyan-300 sm:text-xs">
          Analyzing medicine strip
        </p>
        <div className="mt-2 flex items-center justify-center gap-1">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-cyan-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: index * 0.2 }}
            />
          ))}
        </div>
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-b from-pharma-slate-900/35 via-transparent to-pharma-slate-900/35" />
    </div>
  );
}
