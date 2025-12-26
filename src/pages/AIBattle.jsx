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
  Brain,
  Activity
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
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
  const [sessionAhaScore, setSessionAhaScore] = useState(0);
  const [timeFilter, setTimeFilter] = useState('all');
  const autoSessionMinutes = 2; // Fixed 2-minute auto sessions
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  
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
  
  const { data: sessions = [] } = useQuery({
    queryKey: ['trainingSessions'],
    queryFn: () => base44.entities.TrainingSession.list('-session_date', 20),
    initialData: []
  });
  
  useEffect(() => {
    if (knowledgeData.length > 0) {
      setLearnedData(knowledgeData);
    }
  }, [knowledgeData]);

  // Initialize session AHA score from database
  useEffect(() => {
    if (trainingData.length > 0) {
      setSessionAhaScore(trainingData[0].aha_score || 0);
    }
  }, [trainingData]);
  
  // LEARN TACTICS AND ACTUAL GAMEPLAY SKILLS FROM WINS/LOSSES
  const learnTacticsFromGame = async (gameState, winner, moveCount, gameHistory) => {
    const gameId = `battle_${Date.now()}`;
    const wonGame = winner === 'aha';
    
    // SAVE DETAILED GAME KNOWLEDGE - teach AI actual gameplay patterns
    if (gameHistory && gameHistory.length > 0) {
      const knowledgeRecords = gameHistory.map((move, idx) => ({
        game_id: gameId,
        move_number: idx + 1,
        game_phase: move.phase,
        card_played: move.card,
        hand_size: move.handSize,
        table_state: JSON.stringify(move.tableState),
        decision_type: move.decisionType,
        was_successful: wonGame,
        reward: wonGame ? (0.8 - (idx / gameHistory.length) * 0.3) : (-0.5 + (idx / gameHistory.length) * 0.3),
        aha_score_at_time: sessionAhaScore,
        strategy_snapshot: trainingData.length > 0 ? trainingData[0].strategy_weights : null
      }));
      
      // Save in batches
      if (knowledgeRecords.length > 0) {
        try {
          await base44.entities.AIKnowledge.bulkCreate(knowledgeRecords.slice(0, 50)); // Max 50 moves per game
        } catch (error) {
          console.error('Failed to save game knowledge:', error);
        }
      }
    }
    
    // Generate experimental tactic names
    const tacticTypes = ['Opening', 'Midgame', 'Endgame', 'Trump Control', 'Card Conservation', 'Aggressive Push', 'Defensive Hold'];
    const tacticVariations = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
    
    const randomType = tacticTypes[Math.floor(Math.random() * tacticTypes.length)];
    const randomVar = tacticVariations[Math.floor(Math.random() * tacticVariations.length)];
    const experimentalName = `${randomType} ${randomVar}`;
    
    const newTactics = [];
    
    // Create experimental tactic based on game state
    newTactics.push({
      tactic_name: experimentalName,
      scenario: {
        hand_size: Math.floor(Math.random() * 6) + 1,
        opponent_hand_size: Math.floor(Math.random() * 6) + 1,
        deck_remaining: Math.floor(Math.random() * 36),
        phase: Math.random() > 0.5 ? 'attack' : 'defend'
      },
      action: {
        type: ['aggressive_start', 'conservative', 'multi_attack', 'trump_finish', 'desperate_defense'][Math.floor(Math.random() * 5)],
        card_preference: ['low_cards', 'medium_cards', 'high_trumps', 'duplicates', 'singles', 'any_valid'][Math.floor(Math.random() * 6)],
        aggression_level: Math.random()
      },
      success_rate: wonGame ? 0.55 : 0.45,
      times_used: 1,
      times_won: wonGame ? 1 : 0,
      learned_from_game: gameId,
      confidence: 0.2
    });
    
    // Try to update existing or create new - STRICTLY NO DUPLICATES
    for (const newTactic of newTactics) {
      const exactMatch = tactics.find(t => t.tactic_name === newTactic.tactic_name);
      
      if (exactMatch) {
        // Update existing
        const newTimesUsed = exactMatch.times_used + 1;
        const newTimesWon = exactMatch.times_won + (wonGame ? 1 : 0);
        const newSuccessRate = newTimesWon / newTimesUsed;
        let confidenceChange = wonGame ? 0.12 : -0.08;
        const newConfidence = Math.max(0.01, Math.min(0.99, exactMatch.confidence + confidenceChange));

        try {
          await base44.entities.AHATactic.update(exactMatch.id, {
            times_used: newTimesUsed,
            times_won: newTimesWon,
            success_rate: newSuccessRate,
            confidence: newConfidence
          });
        } catch (error) {
          console.error('Tactic update failed:', error);
        }
      } else {
        // ABSOLUTE DUPLICATE CHECK - check ALL tactics from database
        const allTactics = await base44.entities.AHATactic.list('', 1000);
        const isDuplicate = allTactics.some(t => t.tactic_name === newTactic.tactic_name);
        
        if (!isDuplicate && allTactics.length < 200 && Math.random() > 0.7) {
          // Create new experimental tactic (30% chance, max 200 tactics)
          try {
            await base44.entities.AHATactic.create(newTactic);
            queryClient.invalidateQueries({ queryKey: ['ahaTactics'] });
          } catch (error) {
            console.error('Tactic creation failed:', error);
          }
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
    mutationFn: async ({ sessionGames, sessionWins, ahaScore, winRate }) => {
      if (trainingData.length > 0) {
        const current = trainingData[0];
        await base44.entities.AITrainingData.update(current.id, {
          games_played: (current.games_played || 0) + sessionGames,
          games_won: (current.games_won || 0) + sessionWins,
          aha_score: ahaScore,
          last_training_date: new Date().toISOString()
        });
      }
      
      // Save session data for the graph
      if (sessionGames > 0) {
        await base44.entities.TrainingSession.create({
          session_date: new Date().toISOString(),
          win_rate: winRate,
          games_played: sessionGames,
          aha_wins: sessionWins,
          final_aha_score: ahaScore
        });
      }
      
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['aiTraining'] });
        queryClient.invalidateQueries({ queryKey: ['ahaTactics'] });
        queryClient.invalidateQueries({ queryKey: ['trainingSessions'] });
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
    setGameHistory([]); // Reset history for new game
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
          
          // Record move for learning
          setGameHistory(prev => [...prev, {
            phase: 'attack',
            card: attackCard,
            handSize: state.hands[aiPlayer].length,
            tableState: state.tableCards,
            decisionType: 'attack'
          }]);
          
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
            
            // Record move for learning
            setGameHistory(prev => [...prev, {
              phase: 'attack',
              card: attackCard,
              handSize: state.hands[aiPlayer].length,
              tableState: state.tableCards,
              decisionType: 'attack'
            }]);
            
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
          
          // Record successful defense
          setGameHistory(prev => [...prev, {
            phase: 'defend',
            card: defenseCard,
            handSize: state.hands[aiPlayer].length,
            tableState: state.tableCards,
            decisionType: 'defense'
          }]);
          
          return {
            hands: newHands,
            tableCards: newTableCards,
            phase: allDefended ? 'attack' : 'defend',
            moveCount: state.moveCount + 1
          };
        } else {
          // Record failed defense (taking cards)
          setGameHistory(prev => [...prev, {
            phase: 'defend',
            card: null,
            handSize: state.hands[aiPlayer].length,
            tableState: state.tableCards,
            decisionType: 'take'
          }]);
          
          return endRound(state, true);
        }
      }
    }
    
    return null;
  };
  
  // Auto-restart sessions - use refs to avoid re-creating interval
  const statsRef = useRef(stats);
  const sessionAhaScoreRef = useRef(sessionAhaScore);
  
  useEffect(() => {
    statsRef.current = stats;
    sessionAhaScoreRef.current = sessionAhaScore;
  }, [stats, sessionAhaScore]);
  
  // Countdown timer
  useEffect(() => {
    if (!isRunning || !sessionStartTime) {
      setCountdown(0);
      return;
    }
    
    const updateCountdown = setInterval(() => {
      const elapsed = Date.now() - sessionStartTime;
      const targetMs = autoSessionMinutes * 60 * 1000;
      const remaining = Math.max(0, targetMs - elapsed);
      setCountdown(Math.ceil(remaining / 1000));
    }, 1000);
    
    return () => clearInterval(updateCountdown);
  }, [isRunning, sessionStartTime, autoSessionMinutes]);
  
  useEffect(() => {
    if (!isRunning || !sessionStartTime) return;
    
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - sessionStartTime;
      const targetMs = autoSessionMinutes * 60 * 1000;
      
      if (elapsed >= targetMs && statsRef.current.totalGames > 0) {
        // Auto-save and restart session
        const sessionWinRate = ((statsRef.current.ahaWins / statsRef.current.totalGames) * 100);
        saveTrainingMutation.mutate({
          sessionGames: statsRef.current.totalGames,
          sessionWins: statsRef.current.ahaWins,
          ahaScore: sessionAhaScoreRef.current,
          winRate: sessionWinRate
        });
        
        // Reset session stats
        setStats({ ahaWins: 0, opponentWins: 0, totalGames: 0 });
        setSessionStartTime(Date.now());
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(checkInterval);
  }, [isRunning, sessionStartTime, autoSessionMinutes]);
  
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
          
          // Update AHA score based on performance
          const newScore = winner === 'aha' 
            ? sessionAhaScore + 50
            : Math.max(0, sessionAhaScore - 10);
          
          setSessionAhaScore(newScore);

          // Learn tactics AND gameplay skills from the game
          await learnTacticsFromGame(state, winner, state.moveCount, gameHistory);
          
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
  
  const displayAhaScore = isRunning ? sessionAhaScore : (trainingData.length > 0 ? trainingData[0].aha_score : 0);
  const displayTotalGames = (trainingData.length > 0 ? trainingData[0].games_played : 0) + (isRunning ? stats.totalGames : 0);
  const winRate = stats.totalGames > 0 ? ((stats.ahaWins / stats.totalGames) * 100).toFixed(1) : 0;
  
  // Filter and condense sessions by time period - last data point per day/week
  const getFilteredSessions = () => {
    const now = new Date();
    let filtered = sessions;
    
    if (timeFilter !== 'all') {
      const filterDate = new Date();
      switch(timeFilter) {
        case '1d':
          filterDate.setDate(now.getDate() - 1);
          break;
        case '1w':
          filterDate.setDate(now.getDate() - 7);
          break;
        case '1m':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case '1y':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      filtered = sessions.filter(s => new Date(s.session_date) >= filterDate);
    }
    
    // Condense data - last recorded data point per time unit
    if (timeFilter === '1y') {
      // Group by week - last data point of each week (52 data points)
      const grouped = {};
      filtered.forEach(s => {
        const date = new Date(s.session_date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!grouped[weekKey]) {
          grouped[weekKey] = [];
        }
        grouped[weekKey].push(s);
      });
      
      // Take last session of each week
      return Object.keys(grouped).sort().map(weekKey => {
        const weekSessions = grouped[weekKey].sort((a, b) => 
          new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
        );
        return weekSessions[0]; // Last recorded session of the week
      });
    } else if (timeFilter === '1m' || timeFilter === '1w') {
      // Group by day - last data point of each day
      const grouped = {};
      filtered.forEach(s => {
        const dateKey = new Date(s.session_date).toDateString();
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(s);
      });
      
      // Take last session of each day
      return Object.keys(grouped).sort((a, b) => 
        new Date(a).getTime() - new Date(b).getTime()
      ).map(dateKey => {
        const daySessions = grouped[dateKey].sort((a, b) => 
          new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
        );
        return daySessions[0]; // Last recorded session of the day
      });
    }
    
    return filtered;
  };
  
  const filteredSessions = getFilteredSessions();
  
  return (
    <>
    {isGraphFullscreen && (
      <div className="fixed inset-0 bg-slate-900 z-50 p-6 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-400" />
            Win Rate Progress
          </h2>
          <Button onClick={() => setIsGraphFullscreen(false)} variant="ghost" className="text-white">
            Close
          </Button>
        </div>
        <div className="flex gap-2 mb-4 justify-center">
          {[
            { label: '1D', value: '1d' },
            { label: '1W', value: '1w' },
            { label: '1M', value: '1m' },
            { label: '1Y', value: '1y' },
            { label: 'All', value: 'all' }
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setTimeFilter(filter.value)}
              className={`px-3 py-1 rounded text-xs transition-all ${
                timeFilter === filter.value
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[...filteredSessions].reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="session_date" 
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis 
                stroke="#94a3b8"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                domain={[0, 100]}
                label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value) => [`${value.toFixed(1)}%`, 'Win Rate']}
                labelFormatter={(label) => new Date(label).toLocaleString()}
              />
              <ReferenceLine 
                y={75} 
                stroke="#10b981" 
                strokeDasharray="5 5" 
                strokeWidth={2}
                label={{ value: 'Target: 75%', position: 'right', fill: '#10b981', fontSize: 12 }}
              />
              <Line 
                type="linear" 
                dataKey="win_rate" 
                stroke="#06b6d4" 
                strokeWidth={3}
                dot={{ fill: '#06b6d4', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}
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
                const sessionWinRate = ((stats.ahaWins / stats.totalGames) * 100);
                saveTrainingMutation.mutate({
                  sessionGames: stats.totalGames,
                  sessionWins: stats.ahaWins,
                  ahaScore: sessionAhaScore,
                  winRate: sessionWinRate
                });
              }
            } else {
              // Starting - reset session stats and start timer
              setStats({ ahaWins: 0, opponentWins: 0, totalGames: 0 });
              const dbScore = trainingData.length > 0 ? trainingData[0].aha_score : 0;
              setSessionAhaScore(dbScore);
              setSessionStartTime(Date.now());
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
        {/* Win Rate Progress Graph */}
        <UICard className="bg-gradient-to-br from-cyan-900/30 to-slate-800/40 border-cyan-700/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Win Rate Progress
              </div>
              <div className="flex gap-2 items-center">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setIsGraphFullscreen(true)}
                  className="text-cyan-400 hover:text-cyan-300 text-xs"
                >
                  Fullscreen
                </Button>
                {[
                  { label: '1D', value: '1d' },
                  { label: '1W', value: '1w' },
                  { label: '1M', value: '1m' },
                  { label: '1Y', value: '1y' },
                  { label: 'All', value: 'all' }
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => setTimeFilter(filter.value)}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      timeFilter === filter.value
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Complete a training session to see win rate progress
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...filteredSessions].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="session_date" 
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis 
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      domain={[0, 100]}
                      label={{ value: 'Win Rate %', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      formatter={(value) => [`${value.toFixed(1)}%`, 'Win Rate']}
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                    />
                    <ReferenceLine 
                      y={75} 
                      stroke="#10b981" 
                      strokeDasharray="5 5" 
                      strokeWidth={2}
                      label={{ value: 'Target: 75%', position: 'right', fill: '#10b981', fontSize: 12 }}
                    />
                    <Line 
                      type="linear" 
                      dataKey="win_rate" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      dot={{ fill: '#06b6d4', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </UICard>
      
        {/* Stats Grid */}
        <div className="grid md:grid-cols-6 gap-4">
          <UICard className="bg-gradient-to-br from-purple-900/40 to-purple-800/30 border-purple-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <span className="text-xs text-purple-400">AHA SCORE</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{displayAhaScore.toLocaleString()}</div>
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
                {displayTotalGames.toLocaleString()}
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
              <div className="flex items-center gap-4">
                <div className="text-xs text-emerald-400">
                  🔄 Next collection: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </div>
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
    </>
  );
}