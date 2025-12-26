import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, Trophy, Frown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

import Card from '@/components/durak/Card';
import PlayerHand from '@/components/durak/PlayerHand';
import AIHand from '@/components/durak/AIHand';
import PlayArea from '@/components/durak/PlayArea';
import GameControls from '@/components/durak/GameControls';
import TrumpIndicator from '@/components/durak/TrumpIndicator';
import '@/components/durak/AILoader';

import {
  createDeck,
  dealCards,
  canBeat,
  getValidDefenseCards,
  getValidAttackCards,
  refillHands,
  aiSelectAttack,
  aiSelectDefense,
  aiShouldContinueAttack,
  determineFirstAttacker,
  checkGameOver
} from '@/components/durak/GameEngine';

const AI_DELAY = 1000;
const AI_THINK_TIME = 800;

export default function Game() {
  const urlParams = new URLSearchParams(window.location.search);
  const numAI = parseInt(urlParams.get('players')) || 1;
  const difficulty = urlParams.get('difficulty') || 'medium';
  const isChampionMode = urlParams.get('mode') === 'champion';
  
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [gameMessage, setGameMessage] = useState('');
  const [aiThinking, setAiThinking] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [trainedWeights, setTrainedWeights] = useState(null);
  const [learnedKnowledge, setLearnedKnowledge] = useState(null);
  
  const gameRef = useRef(null);
  
  // Load trained AI data if using AHA difficulty
  const { data: trainingData = [] } = useQuery({
    queryKey: ['aiTraining'],
    queryFn: () => base44.entities.AITrainingData.list(),
    initialData: [],
    enabled: difficulty === 'aha'
  });
  
  const { data: knowledgeData = [] } = useQuery({
    queryKey: ['aiKnowledge'],
    queryFn: () => base44.entities.AIKnowledge.filter({ was_successful: true }, '-reward', 50),
    initialData: [],
    enabled: difficulty === 'aha'
  });
  
  useEffect(() => {
    if (difficulty === 'aha' && trainingData.length > 0) {
      setTrainedWeights(trainingData[0].strategy_weights);
    }
    if (difficulty === 'aha' && knowledgeData.length > 0) {
      setLearnedKnowledge(knowledgeData);
    }
  }, [difficulty, trainingData, knowledgeData]);
  
  const initGame = useCallback(() => {
    const deck = createDeck();
    const numPlayers = numAI + 1;
    const { hands, remainingDeck } = dealCards(deck, numPlayers);
    
    const trumpCard = remainingDeck[0];
    const trumpSuit = trumpCard.suit;
    
    const firstAttacker = determineFirstAttacker(hands, trumpSuit);
    const defender = (firstAttacker + 1) % numPlayers;
    
    const state = {
      hands,
      deck: remainingDeck,
      trumpCard,
      trumpSuit,
      attacker: firstAttacker,
      defender,
      tableCards: [],
      phase: 'attack',
      passers: []
    };
    
    gameRef.current = state;
    setGameState(state);
    setSelectedCard(null);
    setGameOver(null);
    setGameMessage(firstAttacker === 0 ? 'Your turn to attack!' : 'AI is attacking...');
  }, [numAI]);
  
  useEffect(() => {
    initGame();
  }, [initGame]);
  
  const updateGameState = useCallback((updates) => {
    setGameState(prev => {
      const newState = { ...prev, ...updates };
      gameRef.current = newState;
      return newState;
    });
  }, []);
  
  const checkAndHandleGameOver = useCallback(async (hands, deckEmpty) => {
    const result = checkGameOver(hands, deckEmpty);
    if (result.over) {
      setGameOver({
        durak: result.durak,
        isPlayerDurak: result.durak === 0,
        isPlayerWinner: result.durak !== 0 && result.durak !== null
      });
      
      // Log this game to improve AI if playing against AHA
      if (difficulty === 'aha' && trainingData.length > 0) {
        try {
          const currentData = trainingData[0];
          await base44.entities.AITrainingData.update(currentData.id, {
            games_played: (currentData.games_played || 0) + 1,
            games_won: (currentData.games_won || 0) + (result.durak !== 0 ? 1 : 0),
            aha_score: result.durak === 0 
              ? Math.max(0, (currentData.aha_score || 0) + 15) // AI won, increase score
              : Math.max(0, (currentData.aha_score || 0) - 8), // AI lost, slightly decrease
            last_training_date: new Date().toISOString()
          });
        } catch (e) {}
      }
      
      return true;
    }
    return false;
  }, [difficulty, trainingData]);
  
  const endRound = useCallback((defenderTook = false) => {
    const state = gameRef.current;
    if (!state) return;
    
    let newHands = [...state.hands];
    
    if (defenderTook) {
      const allCards = state.tableCards.flatMap(p => [p.attack, p.defense].filter(Boolean));
      newHands[state.defender] = [...newHands[state.defender], ...allCards];
    }
    
    // Refill hands ONLY if deck has cards
    let refilledHands = newHands;
    let remainingDeck = state.deck;
    
    if (state.deck.length > 0) {
      const refillResult = refillHands(newHands, state.deck, state.attacker);
      refilledHands = refillResult.hands;
      remainingDeck = refillResult.remainingDeck;
    }
    
    // Check game over - deck empty AND at least one player has no cards
    const deckEmpty = remainingDeck.length === 0;
    
    if (checkAndHandleGameOver(refilledHands, deckEmpty)) {
      updateGameState({ hands: refilledHands, deck: remainingDeck, tableCards: [], trumpCard: deckEmpty ? null : state.trumpCard });
      return;
    }
    
    const numPlayers = refilledHands.length;
    let nextAttacker, nextDefender;
    
    // PROPER DURAK RULES: If defender successfully defended, they become attacker
    if (!defenderTook) {
      nextAttacker = state.defender; // Successful defender becomes attacker
      nextDefender = (nextAttacker + 1) % numPlayers;
    } else {
      // If defender took cards, attacker stays attacker, next player becomes defender
      nextAttacker = state.attacker;
      nextDefender = (state.defender + 1) % numPlayers;
    }
    
    // Skip players with no cards (after deck is empty)
    if (deckEmpty) {
      while (refilledHands[nextAttacker]?.length === 0) {
        nextAttacker = (nextAttacker + 1) % numPlayers;
        if (nextAttacker === state.attacker) break;
      }
      while (refilledHands[nextDefender]?.length === 0) {
        nextDefender = (nextDefender + 1) % numPlayers;
        if (nextDefender === nextAttacker) break;
      }
    }
    
    updateGameState({
      hands: refilledHands,
      deck: remainingDeck,
      trumpCard: remainingDeck.length > 0 ? state.trumpCard : null,
      tableCards: [],
      attacker: nextAttacker,
      defender: nextDefender,
      phase: 'attack',
      passers: []
    });
    
    setSelectedCard(null);
    
    // Better messaging based on who's attacking
    if (nextAttacker === 0) {
      setGameMessage(deckEmpty ? 'Your turn to attack! (No more cards to draw)' : 'Your turn to attack!');
    } else {
      setGameMessage(deckEmpty ? 'AI is attacking... (No more cards to draw)' : 'AI is attacking...');
    }
  }, [updateGameState, checkAndHandleGameOver]);
  
  // AI Logic
  useEffect(() => {
    if (!gameState || gameOver) return;
    
    const isAITurn = gameState.phase === 'attack' 
      ? gameState.attacker !== 0 
      : gameState.defender !== 0;
    
    if (!isAITurn) return;
    
    const aiPlayer = gameState.phase === 'attack' ? gameState.attacker : gameState.defender;
    setAiThinking(aiPlayer);
    
    const timer = setTimeout(() => {
      const state = gameRef.current;
      if (!state || !state.hands || !state.hands[aiPlayer]) {
        setAiThinking(null);
        return;
      }

      // Safety check - prevent infinite loops
      if (state.hands[aiPlayer].length === 0) {
        setAiThinking(null);
        endRound(false);
        return;
      }
      
      const aiDifficulty = difficulty;
      
      if (state.phase === 'attack') {
        // AI attacking with trained knowledge
        if (state.tableCards.length === 0) {
          // Initial attack - use learned strategies
          const attackCard = aiSelectAttack(
            state.hands[aiPlayer], 
            [], 
            state.trumpSuit, 
            aiDifficulty, 
            trainedWeights, 
            learnedKnowledge,
            state.deck.length,
            state.hands[state.defender]?.length || 0
          );
          if (attackCard && attackCard.suit && attackCard.rank && attackCard.id) {
            const newHands = [...state.hands];
            newHands[aiPlayer] = newHands[aiPlayer].filter(c => c.id !== attackCard.id);
            
            updateGameState({
              hands: newHands,
              tableCards: [{ attack: attackCard, defense: null }],
              phase: 'defend'
            });
            setGameMessage('Defend against the attack!');
          } else {
            // AI has no valid attack, pass turn
            setAiThinking(null);
            endRound(false);
          }
        } else {
          // Continue attack or end - using learned patterns
          const shouldContinue = aiShouldContinueAttack(
            state.hands[aiPlayer],
            state.tableCards,
            state.hands[state.defender].length,
            state.trumpSuit,
            aiDifficulty,
            trainedWeights,
            learnedKnowledge
          );
          
          if (shouldContinue) {
            const attackCard = aiSelectAttack(
              state.hands[aiPlayer], 
              state.tableCards, 
              state.trumpSuit, 
              aiDifficulty, 
              trainedWeights, 
              learnedKnowledge,
              state.deck.length,
              state.hands[state.defender]?.length || 0
              );
              if (attackCard && attackCard.suit && attackCard.rank && attackCard.id) {
              const newHands = [...state.hands];
              newHands[aiPlayer] = newHands[aiPlayer].filter(c => c.id !== attackCard.id);
              
              updateGameState({
                hands: newHands,
                tableCards: [...state.tableCards, { attack: attackCard, defense: null }],
                phase: 'defend'
              });
              setGameMessage('More cards to defend!');
            } else {
              setAiThinking(null);
              endRound(false);
            }
          } else {
            endRound(false);
          }
        }
      } else {
        // AI defending with expert knowledge
        const undefended = state.tableCards.find(p => !p.defense);
        if (undefended) {
          const defenseCard = aiSelectDefense(
            state.hands[aiPlayer],
            undefended.attack,
            state.trumpSuit,
            aiDifficulty,
            trainedWeights,
            learnedKnowledge,
            state.deck.length,
            state.hands[state.attacker]?.length || 0
          );

          if (defenseCard && defenseCard.suit && defenseCard.rank && defenseCard.id) {
            const newHands = [...state.hands];
            newHands[aiPlayer] = newHands[aiPlayer].filter(c => c.id !== defenseCard.id);
            
            const newTableCards = state.tableCards.map(p => {
              if (p === undefended) {
                return { ...p, defense: defenseCard };
              }
              return p;
            });
            
            const allDefended = newTableCards.every(p => p.defense);
            
            updateGameState({
              hands: newHands,
              tableCards: newTableCards,
              phase: allDefended ? 'attack' : 'defend'
            });
            
            if (allDefended) {
              setGameMessage('All defended! Attacker can add more or pass.');
            }
          } else {
            // Take cards
            setGameMessage('AI takes the cards!');
            setAiThinking(null);
            setTimeout(() => endRound(true), 500);
          }
        }
      }
      
      setAiThinking(null);
    }, AI_THINK_TIME);
    
    return () => clearTimeout(timer);
  }, [gameState, gameOver, difficulty, isChampionMode, updateGameState, endRound, trainedWeights, learnedKnowledge]);
  
  const handleCardSelect = (card) => {
    setSelectedCard(prev => prev?.id === card.id ? null : card);
  };
  
  const handlePlayCard = () => {
    if (!selectedCard || !gameState) return;
    
    if (gameState.phase === 'attack' && gameState.attacker === 0) {
      const newHands = [...gameState.hands];
      newHands[0] = newHands[0].filter(c => c.id !== selectedCard.id);
      
      updateGameState({
        hands: newHands,
        tableCards: [...gameState.tableCards, { attack: selectedCard, defense: null }],
        phase: 'defend'
      });
      setSelectedCard(null);
      setGameMessage('Waiting for defense...');
    } else if (gameState.phase === 'defend' && gameState.defender === 0) {
      // Find first undefended card
      const undefendedIndex = gameState.tableCards.findIndex(p => !p.defense);
      if (undefendedIndex !== -1) {
        handleDefend(undefendedIndex);
      }
    }
  };
  
  const handleDefend = (pairIndex) => {
    if (!selectedCard || !gameState || gameState.defender !== 0) return;
    
    const pair = gameState.tableCards[pairIndex];
    if (pair.defense) return;
    
    if (!canBeat(pair.attack, selectedCard, gameState.trumpSuit)) return;
    
    const newHands = [...gameState.hands];
    newHands[0] = newHands[0].filter(c => c.id !== selectedCard.id);
    
    const newTableCards = [...gameState.tableCards];
    newTableCards[pairIndex] = { ...pair, defense: selectedCard };
    
    const allDefended = newTableCards.every(p => p.defense);
    
    updateGameState({
      hands: newHands,
      tableCards: newTableCards,
      phase: allDefended ? 'attack' : 'defend'
    });
    
    setSelectedCard(null);
    
    if (allDefended) {
      setGameMessage('All defended! Wait for attacker...');
    }
  };
  
  const handleTakeCards = () => {
    setGameMessage('You take the cards...');
    setTimeout(() => endRound(true), 500);
  };
  
  const handleEndAttack = () => {
    endRound(false);
  };
  
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }
  
  const isPlayerAttacker = gameState.attacker === 0;
  const isPlayerDefender = gameState.defender === 0;
  const playerHand = gameState.hands[0];
  
  const validCards = isPlayerAttacker && gameState.phase === 'attack'
    ? getValidAttackCards(playerHand, gameState.tableCards)
    : isPlayerDefender && gameState.phase === 'defend'
    ? getValidDefenseCards(playerHand, gameState.tableCards.find(p => !p.defense)?.attack, gameState.trumpSuit)
    : [];
  
  const canEndAttack = isPlayerAttacker && gameState.phase === 'attack' && gameState.tableCards.length > 0 && gameState.tableCards.every(p => p.defense);
  const canTake = isPlayerDefender && gameState.phase === 'defend' && gameState.tableCards.some(p => !p.defense);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-900 p-4 relative overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 bg-emerald-900/10 opacity-30" />
      
      {/* Header */}
      <div className="relative z-10 flex justify-between items-center mb-4">
        <Link to={createPageUrl('Home')}>
          <Button variant="ghost" className="text-slate-400 hover:text-white gap-2">
            <ArrowLeft className="w-4 h-4" />
            Exit
          </Button>
        </Link>
        
        <TrumpIndicator suit={gameState.trumpSuit} />
        
        <Button variant="ghost" onClick={initGame} className="text-slate-400 hover:text-white gap-2">
          <RotateCcw className="w-4 h-4" />
          Restart
        </Button>
      </div>
      
      {/* Game Area */}
      <div className="relative z-10 flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto">
        {/* AI Players */}
        <div className="flex justify-center gap-8 mb-4">
          {gameState.hands.slice(1).map((hand, idx) => (
            <AIHand
              key={idx + 1}
              cardCount={hand.length}
              name={isChampionMode ? 'World Champion' : `AI ${idx + 1}`}
              position="top"
              isAttacker={gameState.attacker === idx + 1}
              isDefender={gameState.defender === idx + 1}
              isChampion={isChampionMode}
              isThinking={aiThinking === idx + 1}
            />
          ))}
        </div>
        
        {/* Play Area */}
        <div className="flex-1 flex items-center justify-center">
          <PlayArea
            tableCards={gameState.tableCards}
            trumpCard={gameState.trumpCard}
            deckCount={gameState.deck.length}
            onDefend={handleDefend}
            validDefenseCards={validCards}
            selectedCard={selectedCard}
            isDefending={isPlayerDefender && gameState.phase === 'defend'}
          />
        </div>
        
        {/* Controls */}
        <GameControls
          isAttacker={isPlayerAttacker && gameState.phase === 'attack'}
          isDefender={isPlayerDefender && gameState.phase === 'defend'}
          canEndAttack={canEndAttack}
          canTake={canTake}
          onEndAttack={handleEndAttack}
          onTake={handleTakeCards}
          selectedCard={selectedCard}
          onPlayCard={handlePlayCard}
          gameMessage={gameMessage}
        />
        
        {/* Player Hand */}
        <div className="mt-4">
          <PlayerHand
            cards={playerHand}
            onCardSelect={handleCardSelect}
            selectedCard={selectedCard}
            validCards={validCards}
            isActive={(isPlayerAttacker && gameState.phase === 'attack') || (isPlayerDefender && gameState.phase === 'defend')}
          />
        </div>
      </div>
      
      {/* Game Over Modal */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md mx-4 border border-slate-700 shadow-2xl text-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              {gameOver.isPlayerWinner ? (
                <>
                  <Trophy className="w-20 h-20 text-amber-400 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-white mb-2">Victory!</h2>
                  <p className="text-slate-400 mb-6">
                    {isChampionMode 
                      ? "You've defeated the World Champion!" 
                      : "Congratulations! You got rid of all your cards!"}
                  </p>
                </>
              ) : gameOver.isPlayerDurak ? (
                <>
                  <Frown className="w-20 h-20 text-slate-500 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-white mb-2">Durak!</h2>
                  <p className="text-slate-400 mb-6">
                    You're the fool this time. Better luck next game!
                  </p>
                </>
              ) : (
                <>
                  <Trophy className="w-20 h-20 text-amber-400 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-white mb-2">Game Over!</h2>
                  <p className="text-slate-400 mb-6">AI {gameOver.durak} is the Durak!</p>
                </>
              )}
              
              <div className="flex gap-3 justify-center">
                <Button onClick={initGame} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </Button>
                <Link to={createPageUrl('Home')}>
                  <Button variant="outline" className="border-slate-600 text-slate-300">
                    Main Menu
                  </Button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}