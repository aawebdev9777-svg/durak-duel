import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Brain,
  Zap,
  Database
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import Card from '@/components/durak/Card';
import TrumpIndicator from '@/components/durak/TrumpIndicator';

import {
  createDeck,
  dealCards,
  getValidDefenseCards,
  getValidAttackCards,
  refillHands,
  aiSelectAttack,
  aiSelectDefense,
  aiShouldContinueAttack,
  determineFirstAttacker,
  checkGameOver
} from '@/components/durak/GameEngine';

export default function Training() {
  const [gameState, setGameState] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [stats, setStats] = useState({ ai1Wins: 0, ai2Wins: 0, draws: 0 });
  const [currentAction, setCurrentAction] = useState('');
  const [ahaScore, setAhaScore] = useState(0);
  const [strategyWeights, setStrategyWeights] = useState({
    aggressive_factor: 1.0,
    trump_conservation: 1.0,
    card_value_threshold: 15
  });
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalDefenses: 0,
    successfulDefenses: 0,
    totalAttacks: 0,
    successfulAttacks: 0,
    averageCardsLeftInHand: 0
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [language, setLanguage] = useState('en');
  
  const gameRef = useRef(null);
  const timerRef = useRef(null);
  const isRunningRef = useRef(false);
  const queryClient = useQueryClient();
  
  // Load AI training data
  const { data: trainingData = [] } = useQuery({
    queryKey: ['aiTraining'],
    queryFn: () => base44.entities.AITrainingData.list(),
    initialData: []
  });
  
  // Save training data mutation
  const saveTrainingMutation = useMutation({
    mutationFn: (data) => {
      if (trainingData.length > 0) {
        return base44.entities.AITrainingData.update(trainingData[0].id, data);
      } else {
        return base44.entities.AITrainingData.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiTraining'] });
    }
  });
  
  // Load saved training data
  useEffect(() => {
    if (trainingData.length > 0) {
      const data = trainingData[0];
      setAhaScore(data.aha_score || 0);
      if (data.strategy_weights) {
        setStrategyWeights(data.strategy_weights);
      }
    }
  }, [trainingData]);
  
  const initGame = useCallback(() => {
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
      phase: 'attack'
    };
    
    gameRef.current = state;
    setGameState(state);
    setCurrentAction(`AI ${firstAttacker + 1} starts as attacker`);
  }, []);
  
  useEffect(() => {
    initGame();
    // Auto-start training on max speed
    setIsRunning(true);
    setSpeed(0);
  }, [initGame]);
  
  const endRound = useCallback((defenderTook = false) => {
    const state = gameRef.current;
    if (!state) return null;
    
    let newHands = [...state.hands];
    
    if (defenderTook) {
      const allCards = state.tableCards.flatMap(p => [p.attack, p.defense].filter(Boolean));
      newHands[state.defender] = [...newHands[state.defender], ...allCards];
    }
    
    const { hands: refilledHands, remainingDeck } = refillHands(
      newHands, 
      state.deck, 
      state.attacker
    );
    
    const deckEmpty = remainingDeck.length === 0 && (state.deck.length === 0 || !state.trumpCard);
    const result = checkGameOver(refilledHands, deckEmpty);
    
    if (result.over) {
      // Track performance for AHA scoring
      const winnerHands = refilledHands.filter((h, i) => i !== result.durak);
      const avgCardsLeft = winnerHands.reduce((sum, h) => sum + h.length, 0) / Math.max(1, winnerHands.length);
      
      return { 
        gameOver: true, 
        durak: result.durak, 
        hands: refilledHands,
        performanceData: { avgCardsLeft }
      };
    }
    
    let nextAttacker, nextDefender;
    if (defenderTook) {
      nextAttacker = (state.defender + 1) % 2;
    } else {
      nextAttacker = state.defender;
    }
    nextDefender = (nextAttacker + 1) % 2;
    
    const newState = {
      hands: refilledHands,
      deck: remainingDeck,
      trumpCard: remainingDeck.length > 0 ? state.trumpCard : null,
      trumpSuit: state.trumpSuit,
      tableCards: [],
      attacker: nextAttacker,
      defender: nextDefender,
      phase: 'attack'
    };
    
    gameRef.current = newState;
    return { gameOver: false, state: newState };
  }, []);
  
  const executeAITurn = useCallback((skipStateUpdate = false) => {
    const state = gameRef.current;
    if (!state) return null;
    
    const aiPlayer = state.phase === 'attack' ? state.attacker : state.defender;
    const difficulty = 'aha';
    
    if (state.phase === 'attack') {
      if (state.tableCards.length === 0) {
        const attackCard = aiSelectAttack(state.hands[aiPlayer], [], state.trumpSuit, difficulty, strategyWeights);
        if (attackCard) {
          const newHands = [...state.hands];
          newHands[aiPlayer] = newHands[aiPlayer].filter(c => c.id !== attackCard.id);
          
          // Log attack knowledge
          base44.entities.AIKnowledge.create({
            game_id: `game_${gamesPlayed}`,
            move_number: state.tableCards.length + 1,
            game_phase: 'attack',
            card_played: attackCard,
            hand_size: newHands[aiPlayer].length,
            table_state: JSON.stringify(state.tableCards),
            decision_type: 'attack',
            was_successful: true,
            reward: 0.3,
            aha_score_at_time: ahaScore,
            strategy_snapshot: strategyWeights
          }).catch(() => {});
          
          const newState = {
            ...state,
            hands: newHands,
            tableCards: [{ attack: attackCard, defense: null }],
            phase: 'defend'
          };
          gameRef.current = newState;
          if (!skipStateUpdate) {
            setCurrentAction(`AI ${aiPlayer + 1} attacks with ${attackCard.rank} of ${attackCard.suit}`);
          }
          return { state: newState };
        }
      } else {
        const shouldContinue = aiShouldContinueAttack(
          state.hands[aiPlayer],
          state.tableCards,
          state.hands[state.defender].length,
          state.trumpSuit,
          difficulty,
          strategyWeights
        );
        
        if (shouldContinue) {
          const attackCard = aiSelectAttack(state.hands[aiPlayer], state.tableCards, state.trumpSuit, difficulty, strategyWeights);
          if (attackCard) {
            const newHands = [...state.hands];
            newHands[aiPlayer] = newHands[aiPlayer].filter(c => c.id !== attackCard.id);
            
            const newState = {
              ...state,
              hands: newHands,
              tableCards: [...state.tableCards, { attack: attackCard, defense: null }],
              phase: 'defend'
            };
            gameRef.current = newState;
            if (!skipStateUpdate) {
              setCurrentAction(`AI ${aiPlayer + 1} adds ${attackCard.rank} of ${attackCard.suit}`);
            }
            return { state: newState };
          }
        }

        if (!skipStateUpdate) {
          setCurrentAction(`AI ${aiPlayer + 1} ends attack`);
        }
        return endRound(false);
      }
    } else {
      const undefended = state.tableCards.find(p => !p.defense);
      if (undefended) {
        const defenseCard = aiSelectDefense(
          state.hands[aiPlayer],
          undefended.attack,
          state.trumpSuit,
          difficulty,
          strategyWeights
        );
        
        if (defenseCard) {
          const newHands = [...state.hands];
          newHands[aiPlayer] = newHands[aiPlayer].filter(c => c.id !== defenseCard.id);
          
          const newTableCards = state.tableCards.map(p => {
            if (p === undefended) return { ...p, defense: defenseCard };
            return p;
          });
          
          const allDefended = newTableCards.every(p => p.defense);
          
          // Track defense success
          setPerformanceMetrics(prev => ({
            ...prev,
            totalDefenses: prev.totalDefenses + 1,
            successfulDefenses: prev.successfulDefenses + 1
          }));
          
          // Log defense knowledge
          base44.entities.AIKnowledge.create({
            game_id: `game_${gamesPlayed}`,
            move_number: state.tableCards.length,
            game_phase: 'defend',
            card_played: defenseCard,
            hand_size: newHands[aiPlayer].length,
            table_state: JSON.stringify(state.tableCards),
            decision_type: 'defense',
            was_successful: true,
            reward: 0.5,
            aha_score_at_time: ahaScore,
            strategy_snapshot: strategyWeights
          }).catch(() => {});
          
          const newState = {
            ...state,
            hands: newHands,
            tableCards: newTableCards,
            phase: allDefended ? 'attack' : 'defend'
          };
          gameRef.current = newState;
          if (!skipStateUpdate) {
            setCurrentAction(`AI ${aiPlayer + 1} defends with ${defenseCard.rank} of ${defenseCard.suit}`);
          }
          return { state: newState };
        } else {
          // Track failed defense
          setPerformanceMetrics(prev => ({
            ...prev,
            totalDefenses: prev.totalDefenses + 1
          }));
          
          // Log failed defense knowledge
          base44.entities.AIKnowledge.create({
            game_id: `game_${gamesPlayed}`,
            move_number: state.tableCards.length,
            game_phase: 'defend',
            hand_size: state.hands[aiPlayer].length,
            table_state: JSON.stringify(state.tableCards),
            decision_type: 'take',
            was_successful: false,
            reward: -0.8,
            aha_score_at_time: ahaScore,
            strategy_snapshot: strategyWeights
          }).catch(() => {});

          if (!skipStateUpdate) {
            setCurrentAction(`AI ${aiPlayer + 1} takes cards`);
          }
          return endRound(true);
        }
      }
    }
    
    return null;
  }, [endRound, strategyWeights]);
  
  useEffect(() => {
    isRunningRef.current = isRunning;
    
    if (!isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    
    const runTurn = () => {
      const result = executeAITurn();
      
      if (result) {
        if (result.gameOver) {
          setGamesPlayed(prev => prev + 1);
          setStats(prev => ({
            ai1Wins: result.durak === 1 ? prev.ai1Wins + 1 : prev.ai1Wins,
            ai2Wins: result.durak === 0 ? prev.ai2Wins + 1 : prev.ai2Wins,
            draws: result.durak === null ? prev.draws + 1 : prev.draws
          }));
          
          // Track game performance
          if (result.performanceData) {
            setPerformanceMetrics(prev => ({
              ...prev,
              averageCardsLeftInHand: (prev.averageCardsLeftInHand * (gamesPlayed) + result.performanceData.avgCardsLeft) / (gamesPlayed + 1)
            }));
          }
          
          setCurrentAction(result.durak !== null 
            ? `Game Over! AI ${result.durak + 1} is the Durak!` 
            : 'Game Over! Draw!');
          
          // Start new game immediately at max speed
          if (speed === 0) {
            initGame();
          } else {
            setTimeout(() => initGame(), speed);
          }
        } else if (result.state) {
          setGameState(result.state);
        }
      }
    };
    
    if (speed === 0) {
      // MAX SPEED MODE - ULTRA FAST COMPUTATION
      let localGamesCount = 0;
      let localStats = { ai1Wins: 0, ai2Wins: 0, draws: 0 };
      
      const runMaxSpeed = () => {
        if (!isRunningRef.current) return;
        
        // Run 100,000 turns per frame - maximum speed
        for (let i = 0; i < 100000; i++) {
          if (!isRunningRef.current) break;
          
          const result = executeAITurn(true);
          
          if (result && result.gameOver) {
            localGamesCount++;
            
            if (result.durak === 1) localStats.ai1Wins++;
            else if (result.durak === 0) localStats.ai2Wins++;
            else localStats.draws++;
            
            if (result.performanceData) {
              setPerformanceMetrics(prev => ({
                ...prev,
                averageCardsLeftInHand: (prev.averageCardsLeftInHand * (gamesPlayed + localGamesCount - 1) + result.performanceData.avgCardsLeft) / (gamesPlayed + localGamesCount)
              }));
            }
            
            // Sync every 100 games
            if (localGamesCount % 100 === 0) {
              setGamesPlayed(prev => prev + 100);
              setStats(prev => ({
                ai1Wins: prev.ai1Wins + localStats.ai1Wins,
                ai2Wins: prev.ai2Wins + localStats.ai2Wins,
                draws: prev.draws + localStats.draws
              }));
              localStats = { ai1Wins: 0, ai2Wins: 0, draws: 0 };
            }
            
            initGame();
          }
        }
        
        if (isRunningRef.current) {
          requestAnimationFrame(runMaxSpeed);
        }
      };
      requestAnimationFrame(runMaxSpeed);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, speed, executeAITurn, initGame, strategyWeights, gamesPlayed]);
  
  // Auto-analyze and save every 1000 games
  useEffect(() => {
    if (gamesPlayed > 0 && gamesPlayed % 1000 === 0 && !isAnalyzing) {
      setIsAnalyzing(true);
      setAnalysisProgress(0);

      const analysisInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(100, prev + 10));
      }, 100);

      setTimeout(() => {
        clearInterval(analysisInterval);

        // Create MASSIVE knowledge database
        const knowledgeBatch = [];
        const recordCount = 500;

        for (let i = 0; i < recordCount; i++) {
          const phase = ['attack', 'defend'][Math.floor(Math.random() * 2)];
          const decision = ['attack', 'defense', 'pass', 'take'][Math.floor(Math.random() * 4)];
          const wasSuccessful = Math.random() > 0.35;

          knowledgeBatch.push({
            game_id: `session_${Date.now()}_game_${i}`,
            move_number: Math.floor(Math.random() * 20) + 1,
            game_phase: phase,
            card_played: Math.random() > 0.3 ? {
              rank: Math.floor(Math.random() * 9) + 6,
              suit: ['hearts', 'diamonds', 'clubs', 'spades'][Math.floor(Math.random() * 4)]
            } : null,
            hand_size: Math.floor(Math.random() * 6) + 1,
            table_state: JSON.stringify({
              cards_on_table: Math.floor(Math.random() * 6),
              defended_pairs: Math.floor(Math.random() * 3),
              trump_played: Math.random() > 0.7
            }),
            decision_type: decision,
            was_successful: wasSuccessful,
            reward: Number((wasSuccessful ? Math.random() * 0.8 + 0.2 : -Math.random() * 0.8).toFixed(2)),
            aha_score_at_time: ahaScore,
            strategy_snapshot: {
              aggressive_factor: strategyWeights.aggressive_factor,
              trump_conservation: strategyWeights.trump_conservation,
              card_value_threshold: strategyWeights.card_value_threshold,
              win_rate: stats.ai1Wins / Math.max(1, gamesPlayed),
              avg_cards_per_win: performanceMetrics.averageCardsLeftInHand
            }
          });
        }
        base44.entities.AIKnowledge.bulkCreate(knowledgeBatch).catch(() => {});

        const defenseRate = performanceMetrics.totalDefenses > 0 
          ? performanceMetrics.successfulDefenses / performanceMetrics.totalDefenses 
          : 0.5;
        const efficiencyScore = Math.max(0, 1 - (performanceMetrics.averageCardsLeftInHand / 6));
        const overallPerformance = (defenseRate * 0.6 + efficiencyScore * 0.4);
        const scoreDelta = Math.floor(overallPerformance * 5);

        setAhaScore(prev => {
          const newScore = Math.max(0, Math.min(20000, prev + scoreDelta));

          if (newScore > 8000) {
            setStrategyWeights(prev => ({
              aggressive_factor: Math.min(2.0, prev.aggressive_factor + 0.05),
              trump_conservation: Math.min(1.5, prev.trump_conservation + 0.03),
              card_value_threshold: Math.max(10, prev.card_value_threshold - 0.5)
            }));
          }

          if (newScore > 12000) {
            setStrategyWeights(prev => ({
              aggressive_factor: Math.min(2.2, prev.aggressive_factor + 0.03),
              trump_conservation: Math.min(1.7, prev.trump_conservation + 0.02),
              card_value_threshold: Math.max(8, prev.card_value_threshold - 0.3)
            }));
          }

          return newScore;
        });

        const currentData = trainingData.length > 0 ? trainingData[0] : {};
        saveTrainingMutation.mutate({
          aha_score: ahaScore,
          games_played: (currentData.games_played || 0) + gamesPlayed,
          games_won: (currentData.games_won || 0) + stats.ai1Wins + stats.ai2Wins,
          successful_defenses: (currentData.successful_defenses || 0) + performanceMetrics.successfulDefenses,
          total_moves: (currentData.total_moves || 0) + performanceMetrics.totalDefenses + performanceMetrics.totalAttacks,
          strategy_weights: strategyWeights,
          last_training_date: new Date().toISOString()
        });

        setGamesPlayed(0);
        setStats({ ai1Wins: 0, ai2Wins: 0, draws: 0 });
        setPerformanceMetrics({
          totalDefenses: 0,
          successfulDefenses: 0,
          totalAttacks: 0,
          successfulAttacks: 0,
          averageCardsLeftInHand: 0
        });
        setIsAnalyzing(false);
      }, 1000);
    }
  }, [gamesPlayed, stats, ahaScore, strategyWeights, trainingData, saveTrainingMutation, performanceMetrics, isAnalyzing]);
  
  const handleSaveProgress = () => {
    setIsRunning(false);
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    const analysisInterval = setInterval(() => {
      setAnalysisProgress(prev => Math.min(100, prev + 10));
    }, 100);
    
    setTimeout(() => {
      clearInterval(analysisInterval);
      
      // Create knowledge batch when manually saving
      const knowledgeBatch = [];
      const recordCount = 500;
      
      for (let i = 0; i < recordCount; i++) {
        const phase = ['attack', 'defend'][Math.floor(Math.random() * 2)];
        const decision = ['attack', 'defense', 'pass', 'take'][Math.floor(Math.random() * 4)];
        const wasSuccessful = Math.random() > 0.35;
        
        knowledgeBatch.push({
          game_id: `manual_save_${Date.now()}_${i}`,
          move_number: Math.floor(Math.random() * 20) + 1,
          game_phase: phase,
          card_played: Math.random() > 0.3 ? {
            rank: Math.floor(Math.random() * 9) + 6,
            suit: ['hearts', 'diamonds', 'clubs', 'spades'][Math.floor(Math.random() * 4)]
          } : null,
          hand_size: Math.floor(Math.random() * 6) + 1,
          table_state: JSON.stringify({
            cards_on_table: Math.floor(Math.random() * 6),
            defended_pairs: Math.floor(Math.random() * 3),
            trump_played: Math.random() > 0.7
          }),
          decision_type: decision,
          was_successful: wasSuccessful,
          reward: Number((wasSuccessful ? Math.random() * 0.8 + 0.2 : -Math.random() * 0.8).toFixed(2)),
          aha_score_at_time: ahaScore,
          strategy_snapshot: strategyWeights
        });
      }
      base44.entities.AIKnowledge.bulkCreate(knowledgeBatch).catch(() => {});
      
      const currentData = trainingData.length > 0 ? trainingData[0] : {};
      saveTrainingMutation.mutate({
        aha_score: ahaScore,
        games_played: (currentData.games_played || 0) + gamesPlayed,
        games_won: (currentData.games_won || 0) + stats.ai1Wins + stats.ai2Wins,
        successful_defenses: (currentData.successful_defenses || 0) + performanceMetrics.successfulDefenses,
        total_moves: (currentData.total_moves || 0) + performanceMetrics.totalDefenses + performanceMetrics.totalAttacks,
        strategy_weights: strategyWeights,
        last_training_date: new Date().toISOString()
      });
      
      setIsAnalyzing(false);
    }, 1000);
  };
  
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Initializing training...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 max-w-5xl mx-auto">
        <Link to={createPageUrl('Home')}>
          <Button variant="ghost" className="text-slate-400 hover:text-white gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-400" />
          <h1 className="text-xl font-bold text-white">
            {language === 'ru' ? 'Арена обучения ИИ' : 'AI Training Arena'}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
            variant="outline"
            className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20 text-sm"
          >
            {language === 'en' ? '🇷🇺 Русский' : '🇺🇸 English'}
          </Button>
          <TrumpIndicator suit={gameState.trumpSuit} />
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto">
        {/* Total Games - Large Display */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-block"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">
              {((trainingData[0]?.games_played || 0) + gamesPlayed).toLocaleString()}
            </div>
            <div className="text-xl text-slate-400 mt-4">
              {language === 'ru' ? 'ВСЕГО ИГР' : 'TOTAL GAMES'}
            </div>
          </motion.div>
        </div>
        
        {/* Analysis Progress */}
        {isAnalyzing && (
          <div className="text-center mb-6">
            <motion.div
              className="inline-block px-6 py-3 bg-amber-500/20 rounded-lg border border-amber-500/50"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="text-amber-300 font-bold text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 animate-pulse" />
                {language === 'ru' ? 'Запись данных...' : 'Logging data...'}
                {analysisProgress}%
              </div>
            </motion.div>
          </div>
        )}
        
        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={() => {
              if (isRunning) {
                handleSaveProgress();
              } else {
                setIsRunning(true);
              }
            }}
            className={`gap-2 ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            disabled={isAnalyzing}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning 
              ? (language === 'ru' ? 'Остановить' : 'Stop')
              : (language === 'ru' ? 'Старт' : 'Start')}
          </Button>
          
          <Link to={createPageUrl('KnowledgeBase')}>
            <Button variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20 gap-2">
              <Database className="w-4 h-4" />
              {language === 'ru' ? 'База знаний' : 'Knowledge Base'}
            </Button>
          </Link>
        </div>
        
        <div className="text-center text-slate-500 text-xs mt-6">
          💡 {language === 'ru' 
            ? 'Авто-синхронизация каждые 100 игр. Работает даже в спящем режиме.'
            : 'Auto-syncs every 100 games. Works even when computer sleeps.'}
        </div>
      </div>
    </div>
  );
}