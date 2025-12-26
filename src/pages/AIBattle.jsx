import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Zap,
  Trophy,
  Target,
  TrendingUp,
  Brain
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import Card from '@/components/durak/Card';
import TrumpIndicator from '@/components/durak/TrumpIndicator';
import AIHand from '@/components/durak/AIHand';

import {
  createDeck,
  dealCards,
  aiSelectAttack,
  aiSelectDefense,
  aiShouldContinueAttack,
  refillHands,
  determineFirstAttacker,
  checkGameOver
} from '@/components/durak/GameEngine';

export default function AIBattle() {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState({ ahaWins: 0, opponentWins: 0, totalGames: 0 });
  const [currentGame, setCurrentGame] = useState(null);
  const [speed, setSpeed] = useState(10); // ms per move - fast by default
  const [learnedData, setLearnedData] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  
  const gameRef = useRef(null);
  const isRunningRef = useRef(false);
  const queryClient = useQueryClient();
  
  // Load AHA AI training data
  const { data: trainingData = [] } = useQuery({
    queryKey: ['aiTraining'],
    queryFn: () => base44.entities.AITrainingData.list(),
    initialData: []
  });
  
  const { data: knowledgeData = [] } = useQuery({
    queryKey: ['aiKnowledge'],
    queryFn: () => base44.entities.AIKnowledge.filter({ was_successful: true }, '-reward', 100),
    initialData: []
  });
  
  const { data: tactics = [] } = useQuery({
    queryKey: ['ahaTactics'],
    queryFn: () => base44.entities.AHATactic.list('-success_rate', 50),
    initialData: []
  });
  
  useEffect(() => {
    if (knowledgeData.length > 0) {
      setLearnedData(knowledgeData);
    }
  }, [knowledgeData]);
  
  // LEARN TACTICS FROM WINS/LOSSES
  const learnTacticsFromGame = async (gameState, winner, moveCount) => {
    const gameId = `battle_${Date.now()}`;
    const wonGame = winner === 'aha';
    const newTactics = [];
    
    // Analyze opening (first 3 moves)
    if (moveCount >= 3) {
      newTactics.push({
        tactic_name: wonGame ? 'Winning Opening' : 'Failed Opening',
        scenario: {
          hand_size: 6,
          opponent_hand_size: 6,
          deck_remaining: 30,
          phase: 'attack'
        },
        action: {
          type: wonGame ? 'aggressive_start' : 'defensive_start',
          card_preference: wonGame ? 'low_cards' : 'medium_cards',
          aggression_level: wonGame ? 0.8 : 0.4
        },
        success_rate: wonGame ? 0.6 : 0.4,
        times_used: 1,
        times_won: wonGame ? 1 : 0,
        learned_from_game: gameId,
        confidence: 0.3 // Start low, will increase with wins
      });
    }

    // Analyze midgame (moves 4-10)
    if (moveCount >= 8) {
      newTactics.push({
        tactic_name: wonGame ? 'Midgame Pressure' : 'Midgame Defense',
        scenario: {
          hand_size: 4,
          opponent_hand_size: 4,
          deck_remaining: 15,
          phase: 'attack'
        },
        action: {
          type: wonGame ? 'multi_attack' : 'conservative',
          card_preference: wonGame ? 'duplicates' : 'singles',
          aggression_level: wonGame ? 0.9 : 0.3
        },
        success_rate: wonGame ? 0.6 : 0.4,
        times_used: 1,
        times_won: wonGame ? 1 : 0,
        learned_from_game: gameId,
        confidence: 0.3 // Start low
      });
    }

    // Analyze endgame
    newTactics.push({
      tactic_name: wonGame ? 'Endgame Domination' : 'Endgame Struggle',
      scenario: {
        hand_size: 2,
        opponent_hand_size: 2,
        deck_remaining: 0,
        phase: wonGame ? 'attack' : 'defend'
      },
      action: {
        type: wonGame ? 'trump_finish' : 'desperate_defense',
        card_preference: wonGame ? 'high_trumps' : 'any_valid',
        aggression_level: wonGame ? 1.0 : 0.2
      },
      success_rate: wonGame ? 0.6 : 0.4,
      times_used: 1,
      times_won: wonGame ? 1 : 0,
      learned_from_game: gameId,
      confidence: 0.3 // Start low
    });
    
    // Check for similar tactics FIRST, only create if none exist
    for (const newTactic of newTactics) {
      let foundSimilar = false;

      for (const existingTactic of tactics) {
        const similarity = calculateTacticSimilarity(existingTactic, newTactic);
        if (similarity > 0.7) {
          foundSimilar = true;
          const newTimesUsed = existingTactic.times_used + 1;
          const newTimesWon = existingTactic.times_won + (wonGame ? 1 : 0);
          const newSuccessRate = newTimesWon / newTimesUsed;

          // Confidence rises and falls naturally
          let confidenceChange = wonGame ? 0.12 : -0.08;
          const newConfidence = Math.max(0.01, Math.min(0.99, existingTactic.confidence + confidenceChange));

          try {
            await base44.entities.AHATactic.update(existingTactic.id, {
              times_used: newTimesUsed,
              times_won: newTimesWon,
              success_rate: newSuccessRate,
              confidence: newConfidence
            });
            await new Promise(resolve => setTimeout(resolve, 300));
            break; // Only update first similar tactic
          } catch (error) {
            console.error('Tactic update failed:', error);
          }
        }
      }

      // Only create new tactic if no similar one was found
      if (!foundSimilar && tactics.length < 50) {
        try {
          await base44.entities.AHATactic.create(newTactic);
          await new Promise(resolve => setTimeout(resolve, 300));
          break; // Only create 1 new tactic per game
        } catch (error) {
          console.error('Tactic save failed:', error);
        }
      }
    }
  };
  
  const calculateTacticSimilarity = (tactic1, tactic2) => {
    if (!tactic1.scenario || !tactic2.scenario || !tactic1.action || !tactic2.action) return 0;

    // Exact name match = duplicate
    if (tactic1.tactic_name === tactic2.tactic_name) return 1.0;

    const handDiff = Math.abs((tactic1.scenario.hand_size || 0) - (tactic2.scenario.hand_size || 0));
    const deckDiff = Math.abs((tactic1.scenario.deck_remaining || 0) - (tactic2.scenario.deck_remaining || 0));

    let similarity = 0.0;

    // Same phase is important
    if (tactic1.scenario.phase === tactic2.scenario.phase) similarity += 0.3;

    // Same action type is important
    if (tactic1.action.type === tactic2.action.type) similarity += 0.3;

    // Similar hand size
    if (handDiff <= 1) similarity += 0.2;

    // Similar deck remaining
    if (deckDiff <= 5) similarity += 0.2;

    return similarity;
  };
  
  // Save training mutation with tactic learning
  const saveTrainingMutation = useMutation({
    mutationFn: async ({ sessionGames, sessionWins, ahaScore }) => {
      if (trainingData.length > 0) {
        const current = trainingData[0];
        await base44.entities.AITrainingData.update(current.id, {
          games_played: (current.games_played || 0) + sessionGames,
          games_won: (current.games_won || 0) + sessionWins,
          aha_score: ahaScore,
          last_training_date: new Date().toISOString()
        });
      }
      
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['aiTraining'] });
        queryClient.invalidateQueries({ queryKey: ['ahaTactics'] });
      }
      });
  
  const initGame = () => {
    const deck = createDeck();
    const { hands, remainingDeck } = dealCards(deck, 2);
    
    const trumpCard = remainingDeck[0];
    const trumpSuit = trumpCard.suit;
    const firstAttacker = determineFirstAttacker(hands, trumpSuit);
    
    const state = {
      hands,
      deck: remainingDeck,
      trumpCard,
      trumpSuit,
      attacker: firstAttacker,
      defender: (firstAttacker + 1) % 2,
      tableCards: [],
      phase: 'attack',
      moveCount: 0
    };
    
    gameRef.current = state;
    setCurrentGame(state);
    return state;
  };
  
  const endRound = (state, defenderTook = false) => {
    let newHands = [...state.hands];
    
    if (defenderTook) {
      const allCards = state.tableCards.flatMap(p => [p.attack, p.defense].filter(Boolean));
      newHands[state.defender] = [...newHands[state.defender], ...allCards];
    }
    
    let refilledHands = newHands;
    let remainingDeck = state.deck;
    
    if (state.deck.length > 0) {
      const refillResult = refillHands(newHands, state.deck, state.attacker);
      refilledHands = refillResult.hands;
      remainingDeck = refillResult.remainingDeck;
    }
    
    const deckEmpty = remainingDeck.length === 0;
    const result = checkGameOver(refilledHands, deckEmpty);
    
    if (result.over) {
      return { gameOver: true, durak: result.durak, hands: refilledHands };
    }
    
    let nextAttacker, nextDefender;
    if (!defenderTook) {
      nextAttacker = state.defender;
      nextDefender = (nextAttacker + 1) % 2;
    } else {
      nextAttacker = state.attacker;
      nextDefender = (state.defender + 1) % 2;
    }
    
    return {
      gameOver: false,
      state: {
        hands: refilledHands,
        deck: remainingDeck,
        trumpCard: remainingDeck.length > 0 ? state.trumpCard : null,
        trumpSuit: state.trumpSuit,
        tableCards: [],
        attacker: nextAttacker,
        defender: nextDefender,
        phase: 'attack',
        moveCount: state.moveCount + 1
      }
    };
  };
  
  const playAIMove = async (state) => {
    const aiPlayer = state.phase === 'attack' ? state.attacker : state.defender;
    const aiDifficulty = aiPlayer === 0 ? 'aha' : 'hard'; // AHA vs Hard AI
    
    const weights = trainingData.length > 0 ? trainingData[0].strategy_weights : null;
    
    if (state.phase === 'attack') {
      if (state.tableCards.length === 0) {
        const attackCard = aiSelectAttack(
          state.hands[aiPlayer], 
          [], 
          state.trumpSuit, 
          aiDifficulty,
          weights,
          learnedData,
          state.deck.length,
          state.hands[state.defender]?.length || 0,
          tactics
        );
        
        if (attackCard && attackCard.id) {
          const newHands = [...state.hands];
          newHands[aiPlayer] = newHands[aiPlayer].filter(c => c.id !== attackCard.id);
          
          return {
            hands: newHands,
            tableCards: [{ attack: attackCard, defense: null }],
            phase: 'defend',
            moveCount: state.moveCount + 1
          };
        } else {
          return endRound(state, false);
        }
      } else {
        const shouldContinue = aiShouldContinueAttack(
          state.hands[aiPlayer],
          state.tableCards,
          state.hands[state.defender].length,
          state.trumpSuit,
          aiDifficulty,
          weights,
          learnedData
        );
        
        if (shouldContinue) {
          const attackCard = aiSelectAttack(
            state.hands[aiPlayer], 
            state.tableCards, 
            state.trumpSuit, 
            aiDifficulty,
            weights,
            learnedData,
            state.deck.length,
            state.hands[state.defender]?.length || 0,
            tactics
          );
          
          if (attackCard && attackCard.id) {
            const newHands = [...state.hands];
            newHands[aiPlayer] = newHands[aiPlayer].filter(c => c.id !== attackCard.id);
            
            return {
              hands: newHands,
              tableCards: [...state.tableCards, { attack: attackCard, defense: null }],
              phase: 'defend',
              moveCount: state.moveCount + 1
            };
          }
        }
        
        return endRound(state, false);
      }
    } else {
      const undefended = state.tableCards.find(p => !p.defense);
      if (undefended) {
        const defenseCard = aiSelectDefense(
          state.hands[aiPlayer],
          undefended.attack,
          state.trumpSuit,
          aiDifficulty,
          weights,
          learnedData,
          state.deck.length,
          state.hands[state.attacker]?.length || 0,
          tactics
        );
        
        if (defenseCard && defenseCard.id) {
          const newHands = [...state.hands];
          newHands[aiPlayer] = newHands[aiPlayer].filter(c => c.id !== defenseCard.id);
          
          const newTableCards = state.tableCards.map(p => {
            if (p === undefended) return { ...p, defense: defenseCard };
            return p;
          });
          
          const allDefended = newTableCards.every(p => p.defense);
          
          return {
            hands: newHands,
            tableCards: newTableCards,
            phase: allDefended ? 'attack' : 'defend',
            moveCount: state.moveCount + 1
          };
        } else {
          return endRound(state, true);
        }
      }
    }
    
    return null;
  };
  
  useEffect(() => {
    isRunningRef.current = isRunning;
    
    if (!isRunning) return;
    
    let state = gameRef.current || initGame();
    
    const runBattle = async () => {
      while (isRunningRef.current) {
        const result = await playAIMove(state);
        
        if (!result) break;
        
        if (result.gameOver) {
          // Game finished - in Durak, someone must be the durak (loser)
          const winner = result.durak === 0 ? 'opponent' : 'aha';

          setStats(prev => ({
            ahaWins: prev.ahaWins + (winner === 'aha' ? 1 : 0),
            opponentWins: prev.opponentWins + (winner === 'opponent' ? 1 : 0),
            totalGames: prev.totalGames + 1
          }));

          // Only add to history if game had moves
          if (state.moveCount > 0) {
            setMatchHistory(prev => [{
              winner,
              moveCount: state.moveCount,
              timestamp: new Date().toISOString()
            }, ...prev.slice(0, 9)]);
          }
          
          // Update AHA score
          const currentScore = trainingData.length > 0 ? trainingData[0].aha_score : 0;
          // Update AHA score based on performance
          const newScore = winner === 'aha' 
            ? currentScore + 50
            : Math.max(0, currentScore - 10);

          // Learn tactics from the game
          await learnTacticsFromGame(state, winner, state.moveCount);
          
          // Start new game
          state = initGame();
        } else if (result.state) {
          state = { ...state, ...result.state };
          gameRef.current = state;
          setCurrentGame(state);
        } else {
          // Update in place
          state = { ...state, ...result };
          gameRef.current = state;
          setCurrentGame(state);
        }
        
        // Speed control
        await new Promise(resolve => setTimeout(resolve, speed));
      }
    };
    
    runBattle();
  }, [isRunning, speed, learnedData, trainingData]);
  
  const currentAhaScore = trainingData.length > 0 ? trainingData[0].aha_score : 0;
  const winRate = stats.totalGames > 0 ? ((stats.ahaWins / stats.totalGames) * 100).toFixed(1) : 0;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 p-4">
      <div className="flex justify-between items-center mb-6 max-w-6xl mx-auto">
        <Link to={createPageUrl('Home')}>
          <Button variant="ghost" className="text-slate-400 hover:text-white gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">AI Battle Arena</h1>
        </div>
        
        <Button
          onClick={() => {
            if (isRunning) {
              // Stopping - save session stats
              setIsRunning(false);
              if (stats.totalGames > 0) {
                const currentScore = trainingData.length > 0 ? trainingData[0].aha_score : 0;
                saveTrainingMutation.mutate({
                  sessionGames: stats.totalGames,
                  sessionWins: stats.ahaWins,
                  ahaScore: currentScore
                });
              }
            } else {
              // Starting - reset session stats
              setStats({ ahaWins: 0, opponentWins: 0, draws: 0, totalGames: 0 });
              setIsRunning(true);
            }
          }}
          className={`gap-2 ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Stop' : 'Start Battle'}
        </Button>
      </div>
      
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-6 gap-4">
          <UICard className="bg-gradient-to-br from-purple-900/40 to-purple-800/30 border-purple-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <span className="text-xs text-purple-400">AHA SCORE</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{currentAhaScore.toLocaleString()}</div>
              <div className="text-sm text-slate-400">Neural Network</div>
            </CardContent>
          </UICard>
          
          <UICard className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/30 border-emerald-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="w-5 h-5 text-emerald-400" />
                <span className="text-xs text-emerald-400">VICTORIES</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.ahaWins}</div>
              <div className="text-sm text-slate-400">AHA Wins</div>
            </CardContent>
          </UICard>
          
          <UICard className="bg-gradient-to-br from-red-900/40 to-red-800/30 border-red-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-5 h-5 text-red-400" />
                <span className="text-xs text-red-400">OPPONENT</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.opponentWins}</div>
              <div className="text-sm text-slate-400">Hard AI Wins</div>
            </CardContent>
          </UICard>
          
          <UICard className="bg-gradient-to-br from-amber-900/40 to-amber-800/30 border-amber-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <span className="text-xs text-amber-400">WIN RATE</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{winRate}%</div>
              <div className="text-sm text-slate-400">Session Rate</div>
            </CardContent>
          </UICard>
          
          <UICard className="bg-gradient-to-br from-blue-900/40 to-blue-800/30 border-blue-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-5 h-5 text-blue-400" />
                <span className="text-xs text-blue-400">MATCHES</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.totalGames}</div>
              <div className="text-sm text-slate-400">Session Games</div>
            </CardContent>
          </UICard>

          <UICard className="bg-gradient-to-br from-indigo-900/40 to-indigo-800/30 border-indigo-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="w-5 h-5 text-indigo-400" />
                <span className="text-xs text-indigo-400">ALL TIME</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {trainingData.length > 0 ? trainingData[0].games_played.toLocaleString() : 0}
              </div>
              <div className="text-sm text-slate-400">Total Games</div>
            </CardContent>
          </UICard>
          </div>
        
        {/* Live Battle Status */}
        <UICard className="bg-slate-800/40 border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <span>Live Battle Status</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Speed:</span>
                <input
                  type="range"
                  min="1"
                  max="2000"
                  value={speed}
                  onChange={(e) => setSpeed(parseInt(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm text-slate-400">{speed}ms</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isRunning ? (
              <div className="text-center py-8 text-slate-500">
                Click "Start Battle" to begin continuous AI training matches
                <div className="text-xs text-slate-600 mt-2">Set speed above 100ms to watch the games</div>
              </div>
            ) : speed < 50 ? (
              <div className="text-center py-8">
                <motion.div
                  className="inline-block"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Zap className="w-16 h-16 text-purple-400" />
                </motion.div>
                <div className="text-white text-xl mt-4">Battle in Progress...</div>
                <div className="text-slate-400 text-sm mt-2">
                  {currentGame && `Move ${currentGame.moveCount} • ${currentGame.phase === 'attack' ? 'Attacking' : 'Defending'}`}
                </div>
                <div className="text-xs text-amber-400 mt-3">
                  Increase speed above 50ms to watch the game
                </div>
              </div>
            ) : currentGame ? (
              <div className="space-y-6">
                {/* AI 1 - AHA */}
                <div className="flex justify-center">
                  <AIHand
                    cardCount={currentGame.hands[0]?.length || 0}
                    name="AHA AI"
                    position="top"
                    isAttacker={currentGame.attacker === 0}
                    isDefender={currentGame.defender === 0}
                    isThinking={false}
                  />
                </div>
                
                {/* Table */}
                <div className="flex justify-center gap-3 min-h-32 items-center flex-wrap">
                  {currentGame.tableCards.length === 0 ? (
                    <div className="text-slate-500 italic">Waiting for attack...</div>
                  ) : (
                    currentGame.tableCards.map((pair, i) => (
                      <motion.div
                        key={`table-${i}`}
                        className="relative"
                        initial={{ scale: 0, y: -20 }}
                        animate={{ scale: 1, y: 0 }}
                      >
                        <Card card={pair.attack} small />
                        {pair.defense && (
                          <motion.div
                            className="absolute top-2 left-2"
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 15 }}
                          >
                            <Card card={pair.defense} small />
                          </motion.div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
                
                {/* Deck & Trump */}
                <div className="flex justify-center items-center gap-4">
                  <div className="text-slate-400 text-sm">
                    Deck: {currentGame.deck?.length || 0}
                  </div>
                  {currentGame.trumpCard && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm">Trump:</span>
                      <TrumpIndicator suit={currentGame.trumpSuit} />
                    </div>
                  )}
                </div>
                
                {/* AI 2 - Hard AI */}
                <div className="flex justify-center">
                  <AIHand
                    cardCount={currentGame.hands[1]?.length || 0}
                    name="Hard AI (Training Partner)"
                    position="top"
                    isAttacker={currentGame.attacker === 1}
                    isDefender={currentGame.defender === 1}
                    isThinking={false}
                  />
                </div>
                
                {/* Move Info */}
                <div className="text-center">
                  <div className="text-white font-medium">
                    Move {currentGame.moveCount} • {currentGame.phase === 'attack' ? 'Attacking' : 'Defending'}
                  </div>
                  <div className="text-slate-400 text-sm mt-1">
                    {currentGame.attacker === 0 ? 'AHA AI attacking' : 'Hard AI attacking'}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </UICard>
        
        {/* Learned Tactics */}
        <UICard className="bg-gradient-to-br from-amber-900/30 to-slate-800/40 border-amber-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Brain className="w-5 h-5 text-amber-400" />
              Learned Tactics ({tactics.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tactics.length === 0 ? (
              <div className="text-center py-4 text-slate-500">Learning tactics from battles...</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {tactics.slice(0, 6).map((tactic, idx) => (
                  <motion.div
                    key={tactic.id}
                    className="bg-slate-800/50 rounded-lg p-3 border border-amber-600/20"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div className="text-amber-400 font-bold text-sm mb-1">{tactic.tactic_name}</div>
                    <div className="text-xs text-slate-400 mb-2">
                      {tactic.action?.type || 'Unknown'} • {tactic.scenario?.phase || 'any'}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-emerald-400">
                        Win Rate: {((tactic.success_rate || 0) * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-slate-500">
                        Used: {tactic.times_used || 0}x
                      </div>
                    </div>
                    <div className="mt-1">
                      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500"
                          style={{ width: `${(tactic.confidence || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </UICard>
        
        {/* Match History */}
        <UICard className="bg-slate-800/40 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white">Recent Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {matchHistory.length === 0 ? (
                <div className="text-center py-4 text-slate-500">No matches yet</div>
              ) : (
                matchHistory.map((match, idx) => (
                  <motion.div
                    key={idx}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      match.winner === 'aha' 
                        ? 'bg-emerald-900/20 border border-emerald-700/30' 
                        : 'bg-red-900/20 border border-red-700/30'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="flex items-center gap-3">
                      {match.winner === 'aha' ? (
                        <Trophy className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Target className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <div className="text-white font-medium">
                          {match.winner === 'aha' ? 'AHA AI Victory' : 'Hard AI Victory'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {match.moveCount} moves • {new Date(match.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </UICard>
        
        <div className="text-center text-slate-400 text-sm space-y-1">
          <p className="text-amber-400 font-bold">
            🧠 AHA AI learns TACTICS from every win and loss
          </p>
          <p className="text-slate-500">
            Opening strategies • Midgame pressure • Endgame domination • Card counting patterns
          </p>
        </div>
      </div>
    </div>
  );
}