import React from 'react';
import { motion } from 'framer-motion';
import Card from './Card';
import { User, Crown, Bot } from 'lucide-react';

export default function AIHand({ 
  cardCount, 
  position = 'top',
  name = 'AI',
  isAttacker = false,
  isDefender = false,
  isChampion = false,
  isThinking = false
}) {
  const positionClasses = {
    top: 'flex-col items-center',
    left: 'flex-row items-center',
    right: 'flex-row-reverse items-center'
  };
  
  const cardClasses = {
    top: 'flex justify-center',
    left: 'flex flex-col',
    right: 'flex flex-col'
  };
  
  const overlap = position === 'top' ? 25 : 15;
  
  return (
    <motion.div 
      className={`flex ${positionClasses[position]} gap-2`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
        isAttacker ? 'bg-red-500/20 border border-red-500/50' :
        isDefender ? 'bg-blue-500/20 border border-blue-500/50' :
        'bg-slate-800/50 border border-slate-700'
      }`}>
        {isChampion ? (
          <Crown className="w-4 h-4 text-amber-400" />
        ) : (
          <Bot className="w-4 h-4 text-slate-400" />
        )}
        <span className={`text-sm font-medium ${isChampion ? 'text-amber-400' : 'text-slate-300'}`}>
          {name}
        </span>
        <span className="text-xs text-slate-500">({cardCount})</span>
        
        {isThinking && (
          <motion.div 
            className="flex gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 bg-amber-400 rounded-full"
                animate={{ y: [0, -5, 0] }}
                transition={{ 
                  duration: 0.5, 
                  repeat: Infinity, 
                  delay: i * 0.15 
                }}
              />
            ))}
          </motion.div>
        )}
      </div>
      
      <div className={cardClasses[position]} style={{ marginTop: position === 'top' ? '8px' : 0 }}>
        <div className="relative flex" style={{ 
          flexDirection: position === 'top' ? 'row' : 'column',
          height: position === 'top' ? 'auto' : `${Math.min(cardCount * overlap + 60, 200)}px`,
          width: position === 'top' ? `${Math.min(cardCount * overlap + 48, 250)}px` : 'auto'
        }}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                [position === 'top' ? 'left' : 'top']: `${i * overlap}px`,
                zIndex: i
              }}
            >
              <Card faceDown small />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}