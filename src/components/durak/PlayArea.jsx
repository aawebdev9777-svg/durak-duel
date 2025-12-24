import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from './Card';

export default function PlayArea({ 
  tableCards = [], 
  trumpCard,
  deckCount,
  onDefend,
  validDefenseCards = [],
  selectedCard,
  isDefending = false
}) {
  return (
    <div className="relative w-full h-48 md:h-64 flex items-center justify-center">
      {/* Deck and Trump */}
      <div className="absolute left-4 md:left-8 flex items-center gap-2">
        {deckCount > 0 && (
          <div className="relative">
            {/* Stack effect */}
            {[...Array(Math.min(3, deckCount))].map((_, i) => (
              <div
                key={i}
                className="absolute w-14 h-20 md:w-16 md:h-24 rounded-lg bg-gradient-to-br from-blue-900 to-blue-800 border border-blue-700"
                style={{
                  top: -i * 2,
                  left: -i * 2,
                  zIndex: -i
                }}
              />
            ))}
            <Card faceDown small />
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-400 font-medium whitespace-nowrap">
              {deckCount} cards
            </div>
          </div>
        )}
        
        {trumpCard && (
          <div className="relative ml-2" style={{ transform: 'rotate(90deg)' }}>
            <Card card={trumpCard} small />
          </div>
        )}
      </div>
      
      {/* Table Cards */}
      <div className="flex flex-wrap justify-center gap-3 md:gap-4 max-w-lg">
        <AnimatePresence mode="popLayout">
          {tableCards.map((pair, index) => (
            <motion.div
              key={`pair-${index}`}
              className="relative"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0, y: 50 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {/* Attack card */}
              <div 
                className={`relative ${isDefending && !pair.defense ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (isDefending && !pair.defense && selectedCard && 
                      validDefenseCards.some(c => c.id === selectedCard.id)) {
                    onDefend(index);
                  }
                }}
              >
                <Card card={pair.attack} />
                
                {/* Highlight for defendable cards */}
                {isDefending && !pair.defense && validDefenseCards.length > 0 && (
                  <motion.div 
                    className="absolute inset-0 rounded-lg border-2 border-amber-400"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </div>
              
              {/* Defense card */}
              {pair.defense && (
                <motion.div
                  className="absolute top-4 left-4 md:top-6 md:left-6"
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 15 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Card card={pair.defense} />
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {tableCards.length === 0 && (
          <div className="text-slate-500 text-lg italic">
            Waiting for attack...
          </div>
        )}
      </div>
    </div>
  );
}