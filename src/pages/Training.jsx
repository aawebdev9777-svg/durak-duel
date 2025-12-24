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
  FastForward, 
  RotateCcw,
  Brain,
  Trophy,
  Zap,
  TrendingUp,
  Save
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
  const [speed, setSpeed] = useState(1000);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [stats, setStats] = useState({ ai1Wins: 0, ai2Wins: 0, draws: 0 });
  const [currentAction, setCurrentAction] = useState('');
  const [ahaScore, setAhaScore] = useState(5000);
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
      setAhaScore(data.aha_score || 5000);
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
    // Auto-start training
    setIsRunning(true);
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
  
  const executeAITurn = useCallback(() => {
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
            game_id: `game_${Date.now()}`,
            move_number: 1,
            game_phase: 'attack',
            card_played: attackCard,
            hand_size: newHands[aiPlayer].length,
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
          setCurrentAction(`AI ${aiPlayer + 1} attacks with ${attackCard.rank} of ${attackCard.suit}`);
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
            setCurrentAction(`AI ${aiPlayer + 1} adds ${attackCard.rank} of ${attackCard.suit}`);
            return { state: newState };
          }
        }
        
        setCurrentAction(`AI ${aiPlayer + 1} ends attack`);
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
          
          // Log knowledge
          base44.entities.AIKnowledge.create({
            game_id: `game_${Date.now()}`,
            move_number: state.tableCards.length,
            game_phase: 'defend',
            card_played: defenseCard,
            hand_size: newHands[aiPlayer].length,
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
          setCurrentAction(`AI ${aiPlayer + 1} defends with ${defenseCard.rank} of ${defenseCard.suit}`);
          return { state: newState };
        } else {
          // Track failed defense
          setPerformanceMetrics(prev => ({
            ...prev,
            totalDefenses: prev.totalDefenses + 1
          }));
          
          // Log failed defense knowledge
          base44.entities.AIKnowledge.create({
            game_id: `game_${Date.now()}`,
            move_number: state.tableCards.length,
            game_phase: 'defend',
            hand_size: state.hands[aiPlayer].length,
            decision_type: 'take',
            was_successful: false,
            reward: -0.8,
            aha_score_at_time: ahaScore,
            strategy_snapshot: strategyWeights
          }).catch(() => {});
          
          setCurrentAction(`AI ${aiPlayer + 1} takes cards`);
          return endRound(true);
        }
      }
    }
    
    return null;
  }, [endRound, strategyWeights]);
  
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    
    timerRef.current = setInterval(() => {
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
          
          // Start new game after delay
          setTimeout(() => initGame(), speed);
        } else if (result.state) {
          setGameState(result.state);
        }
      }
    }, speed);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, speed, executeAITurn, initGame, strategyWeights, gamesPlayed]);
  
  // Update AHA score based on actual performance metrics and auto-save every 100 games
  useEffect(() => {
    if (gamesPlayed > 0 && gamesPlayed % 100 === 0 && !isAnalyzing) {
      // Pause training for analysis
      setIsRunning(false);
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      
      // Simulate analysis with progress bar
      const analysisInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 100) {
            clearInterval(analysisInterval);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
      
      setTimeout(() => {
        clearInterval(analysisInterval);
      // Calculate performance score based on multiple factors
      const defenseRate = performanceMetrics.totalDefenses > 0 
        ? performanceMetrics.successfulDefenses / performanceMetrics.totalDefenses 
        : 0.5;
      
      // Lower cards left = better play (winning with fewer cards)
      const efficiencyScore = Math.max(0, 1 - (performanceMetrics.averageCardsLeftInHand / 6));
      
      // Combined performance (0-1 scale)
      const overallPerformance = (defenseRate * 0.6 + efficiencyScore * 0.4);
      
      // Score delta: -200 to +200 based on how well AI is playing
      const scoreDelta = Math.floor((overallPerformance - 0.5) * 400);
      
      setAhaScore(prev => {
        const newScore = Math.max(1000, Math.min(20000, prev + scoreDelta));
        
        // Evolve strategies based on score thresholds
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
      
        // Auto-save after analysis
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
        
        // Reset counters and resume training
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
        setIsRunning(true);
      }, 2000);
    }
  }, [gamesPlayed, stats, ahaScore, strategyWeights, trainingData, saveTrainingMutation, performanceMetrics, isAnalyzing]);
  
  const handleSaveProgress = () => {
    const currentData = trainingData.length > 0 ? trainingData[0] : {};
    
    saveTrainingMutation.mutate({
      aha_score: ahaScore,
      games_played: (currentData.games_played || 0) + gamesPlayed,
      games_won: (currentData.games_won || 0) + stats.ai1Wins + stats.ai2Wins,
      strategy_weights: strategyWeights,
      last_training_date: new Date().toISOString()
    });
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
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-purple-900/40 rounded-xl p-4 text-center border border-purple-700/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/20 rounded-full blur-2xl" />
            <div className="relative flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <div className="text-2xl font-bold text-purple-400">{ahaScore}</div>
            </div>
            <div className="text-xs text-slate-400">
              {language === 'ru' ? 'Рейтинг АХА' : 'AHA Score'}
            </div>
            {ahaScore >= 10000 && (
              <div className="text-xs text-amber-400 mt-1">
                🏆 {language === 'ru' ? 'Чемпион!' : 'Champion!'}
              </div>
            )}
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
            <div className="text-2xl font-bold text-white">{gamesPlayed}/100</div>
            <div className="text-xs text-slate-400">
              {language === 'ru' ? 'Игры' : 'Games'}
            </div>
          </div>
          <div className="bg-emerald-900/30 rounded-xl p-4 text-center border border-emerald-700/50">
            <div className="text-2xl font-bold text-emerald-400">{stats.ai1Wins}</div>
            <div className="text-xs text-slate-400">
              {language === 'ru' ? 'Победы ИИ 1' : 'AI 1 Wins'}
            </div>
          </div>
          <div className="bg-amber-900/30 rounded-xl p-4 text-center border border-amber-700/50">
            <div className="text-2xl font-bold text-amber-400">{stats.ai2Wins}</div>
            <div className="text-xs text-slate-400">
              {language === 'ru' ? 'Победы ИИ 2' : 'AI 2 Wins'}
            </div>
          </div>
          <div className="bg-slate-700/50 rounded-xl p-4 text-center border border-slate-600">
            <div className="text-2xl font-bold text-slate-300">{stats.draws}</div>
            <div className="text-xs text-slate-400">
              {language === 'ru' ? 'Ничья' : 'Draws'}
            </div>
          </div>
        </div>
        
        {/* Game Visualization */}
        <div className="bg-slate-800/30 rounded-2xl border border-slate-700 p-6 mb-6">
          {/* AI 1 */}
          <div className="flex justify-center mb-6">
            <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
              gameState.attacker === 0 ? 'bg-red-500/20 border border-red-500/50' :
              gameState.defender === 0 ? 'bg-blue-500/20 border border-blue-500/50' :
              'bg-slate-700/50 border border-slate-600'
            }`}>
              <Brain className="w-4 h-4 text-emerald-400" />
              <span className="text-white font-medium">AI 1</span>
              <span className="text-slate-400">({gameState.hands[0].length} cards)</span>
              {gameState.attacker === 0 && <Zap className="w-4 h-4 text-red-400" />}
            </div>
          </div>
          
          {/* AI 1 Hand */}
          <div className="flex justify-center gap-1 mb-8">
            {gameState.hands[0].map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card card={card} small />
              </motion.div>
            ))}
          </div>
          
          {/* Table */}
          <div className="flex justify-center gap-4 mb-8 min-h-32">
            <AnimatePresence mode="popLayout">
              {gameState.tableCards.map((pair, i) => (
                <motion.div
                  key={`table-${i}`}
                  className="relative"
                  initial={{ scale: 0, y: -50 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0, y: 50 }}
                >
                  <Card card={pair.attack} />
                  {pair.defense && (
                    <motion.div
                      className="absolute top-4 left-4"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 15 }}
                    >
                      <Card card={pair.defense} />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {gameState.tableCards.length === 0 && (
              <div className="text-slate-500 italic">No cards on table</div>
            )}
          </div>
          
          {/* AI 2 Hand */}
          <div className="flex justify-center gap-1 mb-6">
            {gameState.hands[1].map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card card={card} small />
              </motion.div>
            ))}
          </div>
          
          {/* AI 2 */}
          <div className="flex justify-center">
            <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
              gameState.attacker === 1 ? 'bg-red-500/20 border border-red-500/50' :
              gameState.defender === 1 ? 'bg-blue-500/20 border border-blue-500/50' :
              'bg-slate-700/50 border border-slate-600'
            }`}>
              <Brain className="w-4 h-4 text-amber-400" />
              <span className="text-white font-medium">AI 2</span>
              <span className="text-slate-400">({gameState.hands[1].length} cards)</span>
              {gameState.attacker === 1 && <Zap className="w-4 h-4 text-red-400" />}
            </div>
          </div>
        </div>
        
        {/* Current Action or Analysis */}
        <div className="text-center mb-6">
          {isAnalyzing ? (
            <motion.div
              className="inline-block px-8 py-4 bg-amber-500/20 rounded-lg border border-amber-500/50"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="text-amber-300 font-bold mb-2">
                {language === 'ru' ? '⚡ Анализ хода...' : '⚡ Analyzing Moves...'}
              </div>
              <div className="w-64 h-3 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
                  initial={{ width: 0 }}
                  animate={{ width: `${analysisProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-2">
                {language === 'ru' 
                  ? `Обработка стратегий... ${analysisProgress}%` 
                  : `Processing strategies... ${analysisProgress}%`}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={currentAction}
              className="inline-block px-6 py-3 bg-purple-500/20 rounded-lg border border-purple-500/50 text-purple-300"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {currentAction}
            </motion.div>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <div className="flex gap-3">
            <Button
              onClick={() => setIsRunning(!isRunning)}
              className={`gap-2 ${isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning 
                ? (language === 'ru' ? 'Пауза' : 'Pause')
                : (language === 'ru' ? 'Начать обучение' : 'Start Training')}
            </Button>
            
            <Button
              onClick={handleSaveProgress}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
              disabled={saveTrainingMutation.isPending}
            >
              <Save className="w-4 h-4" />
              {language === 'ru' ? 'Сохранить' : 'Save Progress'}
            </Button>
            
            <Button
              onClick={initGame}
              variant="outline"
              className="border-slate-600 text-slate-300 gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {language === 'ru' ? 'Сбросить' : 'Reset'}
            </Button>
          </div>
          
          <div className="flex items-center gap-4 min-w-64">
            <FastForward className="w-4 h-4 text-slate-400" />
            <Slider
              value={[2000 - speed]}
              min={0}
              max={1990}
              step={10}
              onValueChange={([v]) => setSpeed(2000 - v)}
              className="flex-1"
            />
            <span className="text-sm text-slate-400 min-w-16">{speed}ms</span>
          </div>
        </div>
        
        <div className="text-center text-slate-500 text-sm mt-6 space-y-2">
          <p>
            {language === 'ru' 
              ? 'Смотрите, как ИИ соревнуются и учатся друг у друга. ИИ АХА учится на каждой игре!'
              : 'Watch AI players compete and learn from each other. The AHA AI learns from every game!'}
          </p>
          <p className="text-purple-400">
            {language === 'ru' ? 'Текущая стратегия' : 'Current Strategy'}: {language === 'ru' ? 'Агрессия' : 'Aggression'} {(strategyWeights.aggressive_factor * 100).toFixed(0)}% 
            | {language === 'ru' ? 'Сохранение козырей' : 'Trump Conservation'} {(strategyWeights.trump_conservation * 100).toFixed(0)}%
            {performanceMetrics.totalDefenses > 0 && ` | ${language === 'ru' ? 'Успешная защита' : 'Defense Rate'} ${((performanceMetrics.successfulDefenses / performanceMetrics.totalDefenses) * 100).toFixed(0)}%`}
          </p>
          <p className="text-xs text-slate-600">
            💡 {language === 'ru' 
              ? 'Система автоматически обрабатывает данные каждые 100 игр и продолжает обучение. Рейтинг 10,000+ = мирового уровня!'
              : 'System analyzes data every 100 games and continues training. 10,000+ AHA Score = World Champion Level!'}
          </p>
        </div>
      </div>
    </div>
  );
}