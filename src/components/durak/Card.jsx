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
    ? "w-14 h-20 md:w-16 md:h-24" 
    : "w-20 h-28 md:w-24 md:h-36";

  if (faceDown) {
    return (
      <motion.div
        className={`${baseClasses} rounded-lg bg-gradient-to-br from-red-800 via-red-700 to-red-900 border-2 border-red-500 shadow-xl flex items-center justify-center relative overflow-hidden`}
        style={style}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Pattern background */}
        <div className="absolute inset-0 opacity-20">
          <div className="grid grid-cols-3 grid-rows-3 h-full w-full">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="flex items-center justify-center text-red-300 text-lg">
                ♦
              </div>
            ))}
          </div>
        </div>
        <div className="w-3/4 h-3/4 rounded-lg border-2 border-amber-400 bg-red-700/50 flex items-center justify-center relative z-10">
          <div className="text-amber-300 text-2xl md:text-4xl font-serif font-bold">Д</div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} rounded-lg bg-white border-3 shadow-2xl cursor-pointer flex flex-col relative overflow-hidden
        ${selectable ? 'hover:shadow-2xl hover:-translate-y-2 transition-all hover:border-amber-400 hover:z-10' : ''}
        ${selected ? 'ring-4 ring-amber-500 -translate-y-3 border-amber-400 z-20' : ''}
      `}
      style={{ 
        backgroundColor: '#FFFFFF',
        borderColor: card.suit === 'hearts' || card.suit === 'diamonds' ? '#DC2626' : '#1E293B',
        borderWidth: '3px',
        ...style 
      }}
      onClick={selectable ? onClick : undefined}
      whileHover={selectable ? { scale: 1.05 } : {}}
      whileTap={selectable ? { scale: 0.98 } : {}}
      initial={{ scale: 0.8, opacity: 0, rotateY: 180 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Top Badge - ALWAYS VISIBLE */}
      <div className={`absolute top-0 left-0 right-0 ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'bg-red-600' : 'bg-slate-800'} text-white font-black text-center py-1 shadow-lg z-10`}>
        <div className="flex items-center justify-center gap-1">
          <span className={small ? 'text-base' : 'text-xl md:text-2xl'}>
            {rankDisplay[card.rank]}
          </span>
          <span className={small ? 'text-base' : 'text-xl md:text-2xl'}>
            {suitSymbols[card.suit]}
          </span>
        </div>
      </div>

      {/* Large Center Symbol */}
      <div className={`flex-1 flex items-center justify-center mt-8 ${suitColors[card.suit]}`}>
        <span className={small ? 'text-5xl' : 'text-7xl md:text-8xl font-bold'}>
          {suitSymbols[card.suit]}
        </span>
      </div>

      {/* Bottom Badge - ALWAYS VISIBLE */}
      <div className={`absolute bottom-0 left-0 right-0 ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'bg-red-600' : 'bg-slate-800'} text-white font-black text-center py-1 shadow-lg rotate-180 z-10`}>
        <div className="flex items-center justify-center gap-1">
          <span className={small ? 'text-base' : 'text-xl md:text-2xl'}>
            {rankDisplay[card.rank]}
          </span>
          <span className={small ? 'text-base' : 'text-xl md:text-2xl'}>
            {suitSymbols[card.suit]}
          </span>
        </div>
      </div>
    </motion.div>
  );
}