import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Check, X, Swords, Shield, SkipForward } from 'lucide-react';

export default function GameControls({
  isAttacker,
  isDefender,
  canPass,
  canTake,
  canEndAttack,
  onPass,
  onTake,
  onEndAttack,
  selectedCard,
  onPlayCard,
  gameMessage
}) {
  return (
    <div className="flex flex-col items-center gap-3 mt-4">
      {gameMessage && (
        <motion.div 
          className="text-center text-slate-300 text-sm md:text-base px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          key={gameMessage}
        >
          {gameMessage}
        </motion.div>
      )}
      
      <div className="flex gap-3 flex-wrap justify-center">
        {isAttacker && (
          <>
            {selectedCard && (
              <Button
                onClick={onPlayCard}
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
              >
                <Swords className="w-4 h-4" />
                Attack
              </Button>
            )}
            {canEndAttack && (
              <Button
                onClick={onEndAttack}
                variant="outline"
                className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/20 gap-2"
              >
                <Check className="w-4 h-4" />
                Done
              </Button>
            )}
          </>
        )}
        
        {isDefender && (
          <>
            {selectedCard && (
              <Button
                onClick={onPlayCard}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                <Shield className="w-4 h-4" />
                Defend
              </Button>
            )}
            {canTake && (
              <Button
                onClick={onTake}
                variant="outline"
                className="border-orange-500 text-orange-400 hover:bg-orange-500/20 gap-2"
              >
                <X className="w-4 h-4" />
                Take Cards
              </Button>
            )}
          </>
        )}
        
        {canPass && (
          <Button
            onClick={onPass}
            variant="outline"
            className="border-slate-500 text-slate-400 hover:bg-slate-500/20 gap-2"
          >
            <SkipForward className="w-4 h-4" />
            Pass
          </Button>
        )}
      </div>
    </div>
  );
}