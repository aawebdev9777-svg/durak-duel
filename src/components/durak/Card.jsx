import React from 'react';
import { motion } from 'framer-motion';

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const suitColors = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-slate-900',
  spades: 'text-slate-900'
};

const rankDisplay = {
  6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

export default function Card({ 
  card, 
  onClick, 
  selectable = false, 
  selected = false,
  faceDown = false,
  small = false,
  style = {}
}) {
  if (!card) return null;

  const baseClasses = small 
    ? "w-12 h-16 md:w-14 md:h-20" 
    : "w-16 h-24 md:w-20 md:h-28";

  if (faceDown) {
    return (
      <motion.div
        className={`${baseClasses} rounded-lg bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 border-2 border-blue-700 shadow-lg flex items-center justify-center`}
        style={style}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="w-3/4 h-3/4 rounded border border-blue-600 bg-blue-800 flex items-center justify-center">
          <div className="text-blue-400 text-xl font-serif">♠</div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} rounded-lg bg-gradient-to-br from-cream-50 to-cream-100 border border-gray-200 shadow-lg cursor-pointer flex flex-col p-1.5 md:p-2 relative overflow-hidden
        ${selectable ? 'hover:shadow-xl hover:-translate-y-2 transition-all' : ''}
        ${selected ? 'ring-2 ring-amber-500 -translate-y-3' : ''}
      `}
      style={{ 
        backgroundColor: '#FDF5E6',
        ...style 
      }}
      onClick={selectable ? onClick : undefined}
      whileHover={selectable ? { scale: 1.05 } : {}}
      whileTap={selectable ? { scale: 0.98 } : {}}
      initial={{ scale: 0.8, opacity: 0, rotateY: 180 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Top left */}
      <div className={`flex flex-col items-center leading-none ${suitColors[card.suit]}`}>
        <span className={`font-bold ${small ? 'text-xs' : 'text-sm md:text-base'}`}>
          {rankDisplay[card.rank]}
        </span>
        <span className={small ? 'text-sm' : 'text-base md:text-lg'}>
          {suitSymbols[card.suit]}
        </span>
      </div>
      
      {/* Center */}
      <div className={`flex-1 flex items-center justify-center ${suitColors[card.suit]}`}>
        <span className={small ? 'text-2xl' : 'text-3xl md:text-4xl'}>
          {suitSymbols[card.suit]}
        </span>
      </div>
      
      {/* Bottom right */}
      <div className={`flex flex-col items-center leading-none rotate-180 ${suitColors[card.suit]}`}>
        <span className={`font-bold ${small ? 'text-xs' : 'text-sm md:text-base'}`}>
          {rankDisplay[card.rank]}
        </span>
        <span className={small ? 'text-sm' : 'text-base md:text-lg'}>
          {suitSymbols[card.suit]}
        </span>
      </div>
    </motion.div>
  );
}