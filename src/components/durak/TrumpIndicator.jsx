import React from 'react';
import { motion } from 'framer-motion';

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const suitColors = {
  hearts: 'text-red-500 bg-red-500/20 border-red-500/50',
  diamonds: 'text-red-500 bg-red-500/20 border-red-500/50',
  clubs: 'text-slate-200 bg-slate-500/20 border-slate-500/50',
  spades: 'text-slate-200 bg-slate-500/20 border-slate-500/50'
};

export default function TrumpIndicator({ suit }) {
  if (!suit) return null;
  
  return (
    <motion.div 
      className={`flex items-center gap-2 px-4 py-2 rounded-full border ${suitColors[suit]}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <span className="text-xs uppercase tracking-wider text-slate-400">Trump</span>
      <span className="text-2xl">{suitSymbols[suit]}</span>
    </motion.div>
  );
}