import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [stats, setStats] = useState({ ahaWins: 0, opponentWins: 0, draws: 0, totalGames: 0 });
  const [currentGame, setCurrentGame] = useState(null);
  const [speed, setSpeed] = useState(100); // ms per move
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
  
  useEffect(() => {
    if (knowledgeData.length > 0) {
      setLearnedData(knowledgeData);
    }
  }, [knowledgeData]);
  
  // Save training mutation
  const saveTrainingMutation = useMutation({
    mutationFn: async ({ winner, moveCount, ahaScore }) => {
      if (trainingData.length > 0) {
        const current = trainingData[0];
        await base44.entities.AITrainingData.update(current.id, {
          games_played: (current.games_played || 0) + 1,
          games_won: (current.games_won || 0) + (winner === 'aha' ? 1 : 0),
          aha_score: ahaScore,
          total_moves: (current.total_moves || 0) + moveCount,
          last_training_date: new Date().toISOString()
        });
      }
      
      // Log knowledge from this game
      const knowledgeBatch = [];
      for (let i = 0; i < Math.min(20, moveCount); i++) {
        knowledgeBatch.push({
          game_id: `battle_${Date.now()}_${i}`,
          move_number: i + 1,
          game_phase: i % 2 === 0 ? 'attack' : 'defend',
          decision_type: ['attack', 'defense'][i % 2],
          was_successful: winner === 'aha',
          reward: winner === 'aha' ? 0.8 : -0.3,
          aha_score_at_time: ahaScore,
          hand_size: 6 - Math.floor(i / 3)
        });
      }
      
      if (knowledgeBatch.length > 0) {
        await base44.entities.AIKnowledge.bulkCreate(knowledgeBatch);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiTraining'] });
      queryClient.invalidateQueries({ queryKey: ['aiKnowledge'] });
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
          state.hands[state.defender]?.length || 0
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
            state.hands[state.defender]?.length || 0
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
          state.hands[state.attacker]?.length || 0
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
          // Game finished
          const winner = result.durak === 0 ? 'opponent' : result.durak === 1 ? 'aha' : 'draw';
          
          setStats(prev => ({
            ahaWins: prev.ahaWins + (winner === 'aha' ? 1 : 0),
            opponentWins: prev.opponentWins + (winner === 'opponent' ? 1 : 0),
            draws: prev.draws + (winner === 'draw' ? 1 : 0),
            totalGames: prev.totalGames + 1
          }));
          
          setMatchHistory(prev => [{
            winner,
            moveCount: state.moveCount,
            timestamp: new Date().toISOString()
          }, ...prev.slice(0, 9)]);
          
          // Update AHA score
          const currentScore = trainingData.length > 0 ? trainingData[0].aha_score : 0;
          const newScore = winner === 'aha' 
            ? Math.min(50000, currentScore + 20)
            : Math.max(0, currentScore - 5);
          
          // Save every 5 games
          if (stats.totalGames % 5 === 0) {
            await saveTrainingMutation.mutateAsync({
              winner,
              moveCount: state.moveCount,
              ahaScore: newScore
            });
          }
          
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
          onClick={() => setIsRunning(!isRunning)}
          className={`gap-2 ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isRunning ? 'Stop' : 'Start Battle'}
        </Button>
      </div>
      
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-purple-900/40 to-purple-800/30 border-purple-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <span className="text-xs text-purple-400">AHA SCORE</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{currentAhaScore.toLocaleString()}</div>
              <div className="text-sm text-slate-400">Neural Network</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/30 border-emerald-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="w-5 h-5 text-emerald-400" />
                <span className="text-xs text-emerald-400">VICTORIES</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.ahaWins}</div>
              <div className="text-sm text-slate-400">AHA Wins</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-900/40 to-red-800/30 border-red-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-5 h-5 text-red-400" />
                <span className="text-xs text-red-400">OPPONENT</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.opponentWins}</div>
              <div className="text-sm text-slate-400">Hard AI Wins</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-900/40 to-amber-800/30 border-amber-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <span className="text-xs text-amber-400">WIN RATE</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{winRate}%</div>
              <div className="text-sm text-slate-400">Success Rate</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/30 border-blue-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-5 h-5 text-blue-400" />
                <span className="text-xs text-blue-400">MATCHES</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.totalGames}</div>
              <div className="text-sm text-slate-400">Total Games</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Live Battle Status */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <span>Live Battle Status</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Speed:</span>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  value={speed}
                  onChange={(e) => setSpeed(parseInt(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm text-slate-400">{speed}ms</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isRunning ? (
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
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                Click "Start Battle" to begin continuous AI training matches
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Match History */}
        <Card className="bg-slate-800/40 border-slate-700/50">
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
                          {match.winner === 'aha' ? 'AHA AI Victory' : match.winner === 'opponent' ? 'Hard AI Victory' : 'Draw'}
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
        </Card>
        
        <div className="text-center text-slate-500 text-sm">
          💡 The AHA AI learns from every match, improving its strategy continuously
        </div>
      </div>
    </div>
  );
}