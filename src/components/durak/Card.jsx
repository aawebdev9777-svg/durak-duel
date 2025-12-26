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

const cardImages = {
  'hearts-6': 'https://deckofcardsapi.com/static/img/6H.png',
  'hearts-7': 'https://deckofcardsapi.com/static/img/7H.png',
  'hearts-8': 'https://deckofcardsapi.com/static/img/8H.png',
  'hearts-9': 'https://deckofcardsapi.com/static/img/9H.png',
  'hearts-10': 'https://deckofcardsapi.com/static/img/0H.png',
  'hearts-11': 'https://deckofcardsapi.com/static/img/JH.png',
  'hearts-12': 'https://deckofcardsapi.com/static/img/QH.png',
  'hearts-13': 'https://deckofcardsapi.com/static/img/KH.png',
  'hearts-14': 'https://deckofcardsapi.com/static/img/AH.png',
  'diamonds-6': 'https://deckofcardsapi.com/static/img/6D.png',
  'diamonds-7': 'https://deckofcardsapi.com/static/img/7D.png',
  'diamonds-8': 'https://deckofcardsapi.com/static/img/8D.png',
  'diamonds-9': 'https://deckofcardsapi.com/static/img/9D.png',
  'diamonds-10': 'https://deckofcardsapi.com/static/img/0D.png',
  'diamonds-11': 'https://deckofcardsapi.com/static/img/JD.png',
  'diamonds-12': 'https://deckofcardsapi.com/static/img/QD.png',
  'diamonds-13': 'https://deckofcardsapi.com/static/img/KD.png',
  'diamonds-14': 'https://deckofcardsapi.com/static/img/AD.png',
  'clubs-6': 'https://deckofcardsapi.com/static/img/6C.png',
  'clubs-7': 'https://deckofcardsapi.com/static/img/7C.png',
  'clubs-8': 'https://deckofcardsapi.com/static/img/8C.png',
  'clubs-9': 'https://deckofcardsapi.com/static/img/9C.png',
  'clubs-10': 'https://deckofcardsapi.com/static/img/0C.png',
  'clubs-11': 'https://deckofcardsapi.com/static/img/JC.png',
  'clubs-12': 'https://deckofcardsapi.com/static/img/QC.png',
  'clubs-13': 'https://deckofcardsapi.com/static/img/KC.png',
  'clubs-14': 'https://deckofcardsapi.com/static/img/AC.png',
  'spades-6': 'https://deckofcardsapi.com/static/img/6S.png',
  'spades-7': 'https://deckofcardsapi.com/static/img/7S.png',
  'spades-8': 'https://deckofcardsapi.com/static/img/8S.png',
  'spades-9': 'https://deckofcardsapi.com/static/img/9S.png',
  'spades-10': 'https://deckofcardsapi.com/static/img/0S.png',
  'spades-11': 'https://deckofcardsapi.com/static/img/JS.png',
  'spades-12': 'https://deckofcardsapi.com/static/img/QS.png',
  'spades-13': 'https://deckofcardsapi.com/static/img/KS.png',
  'spades-14': 'https://deckofcardsapi.com/static/img/AS.png',
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
    ? "w-24 h-16 md:w-28 md:h-18" 
    : "w-36 h-24 md:w-42 md:h-28";
  
  const cardImageUrl = cardImages[`${card.suit}-${card.rank}`];

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

  if (cardImageUrl) {
    return (
      <motion.div
        className={`${baseClasses} rounded-lg shadow-lg cursor-pointer overflow-hidden
          ${selectable ? 'hover:shadow-2xl hover:-translate-y-2 transition-all ring-2 ring-transparent hover:ring-amber-400' : ''}
          ${selected ? 'ring-4 ring-amber-500 -translate-y-3' : ''}
        `}
        style={style}
        onClick={selectable ? onClick : undefined}
        whileHover={selectable ? { scale: 1.05 } : {}}
        whileTap={selectable ? { scale: 0.98 } : {}}
        initial={{ scale: 0.8, opacity: 0, rotateY: 180 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <img 
          src={cardImageUrl} 
          alt={`${rankDisplay[card.rank]} of ${card.suit}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} rounded-lg bg-white border-2 border-slate-300 shadow-lg cursor-pointer flex flex-col p-2 relative
        ${selectable ? 'hover:shadow-2xl hover:-translate-y-2 transition-all hover:border-amber-400' : ''}
        ${selected ? 'ring-4 ring-amber-500 -translate-y-3 border-amber-400' : ''}
      `}
      style={{ 
        backgroundColor: '#FFFFFF',
        ...style 
      }}
      onClick={selectable ? onClick : undefined}
      whileHover={selectable ? { scale: 1.05 } : {}}
      whileTap={selectable ? { scale: 0.98 } : {}}
      initial={{ scale: 0.8, opacity: 0, rotateY: 180 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Top left corner */}
      <div className={`flex flex-col items-center leading-none ${suitColors[card.suit]}`}>
        <span className={`font-black ${small ? 'text-xl' : 'text-3xl md:text-4xl'}`}>
          {rankDisplay[card.rank]}
        </span>
        <span className={small ? 'text-2xl' : 'text-3xl md:text-4xl'}>
          {suitSymbols[card.suit]}
        </span>
      </div>

      {/* Center symbol */}
      <div className={`flex-1 flex items-center justify-center ${suitColors[card.suit]}`}>
        <span className={small ? 'text-5xl' : 'text-7xl md:text-9xl font-bold drop-shadow-sm'}>
          {suitSymbols[card.suit]}
        </span>
      </div>

      {/* Bottom right corner */}
      <div className={`flex flex-col items-center leading-none rotate-180 ${suitColors[card.suit]}`}>
        <span className={`font-black ${small ? 'text-xl' : 'text-3xl md:text-4xl'}`}>
          {rankDisplay[card.rank]}
        </span>
        <span className={small ? 'text-2xl' : 'text-3xl md:text-4xl'}>
          {suitSymbols[card.suit]}
        </span>
      </div>
    </motion.div>
  );
}