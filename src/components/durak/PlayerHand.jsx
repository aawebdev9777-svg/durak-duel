import React from 'react';
import { motion } from 'framer-motion';
import Card from './Card';

export default function PlayerHand({ 
  cards, 
  onCardSelect, 
  selectedCard,
  validCards = [],
  isActive = false,
  label = "Your Hand"
}) {
  const maxSpread = Math.min(cards.length * 60, 500);
  const cardWidth = 80;
  const overlap = cards.length > 1 ? (maxSpread - cardWidth) / (cards.length - 1) : 0;
  
  return (
    <div className="relative">
      {label && (
        <div className={`text-center mb-2 text-sm font-medium ${isActive ? 'text-amber-400' : 'text-gray-400'}`}>
          {label} {isActive && '(Your Turn)'}
        </div>
      )}
      
      <motion.div 
        className="flex justify-center items-end relative"
        style={{ minHeight: '120px' }}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {cards.map((card, index) => {
          const isValid = validCards.some(vc => vc.id === card.id);
          const isSelected = selectedCard?.id === card.id;
          const centerOffset = (cards.length - 1) / 2;
          const rotation = (index - centerOffset) * 3;
          
          return (
            <motion.div
              key={card.id}
              className="absolute hover:z-50"
              style={{
                left: `calc(50% + ${(index - centerOffset) * overlap}px - 40px)`,
                zIndex: isSelected ? 100 : index,
              }}
              animate={{
                rotate: rotation,
                y: isSelected ? -30 : 0,
                scale: isSelected ? 1.1 : 1
              }}
              whileHover={isValid ? { y: -15, scale: 1.05, zIndex: 99 } : {}}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Card
                card={card}
                onClick={() => isValid && onCardSelect(card)}
                selectable={isValid}
                selected={isSelected}
              />
              {!isValid && isActive && (
                <div className="absolute inset-0 bg-black/30 rounded-lg pointer-events-none" />
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}