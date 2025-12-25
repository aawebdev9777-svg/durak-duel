import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Brain, 
  Database,
  TrendingUp,
  Target,
  Award,
  Zap,
  Shield,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function KnowledgeBase() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  // Load AI training data
  const { data: trainingData = [] } = useQuery({
    queryKey: ['aiTraining'],
    queryFn: () => base44.entities.AITrainingData.list(),
    initialData: []
  });
  
  // Load AI knowledge (moves/decisions)
  const { data: knowledgeData = [] } = useQuery({
    queryKey: ['aiKnowledge'],
    queryFn: () => base44.entities.AIKnowledge.list('-created_date', 500),
    initialData: []
  });
  
  const currentData = trainingData.length > 0 ? trainingData[0] : null;
  
  // Calculate statistics
  const stats = {
    totalMoves: knowledgeData.length,
    successfulMoves: knowledgeData.filter(k => k.was_successful).length,
    attackMoves: knowledgeData.filter(k => k.decision_type === 'attack').length,
    defenseMoves: knowledgeData.filter(k => k.decision_type === 'defense').length,
    avgReward: knowledgeData.length > 0 
      ? (knowledgeData.reduce((sum, k) => sum + (k.reward || 0), 0) / knowledgeData.length).toFixed(3)
      : 0
  };
  
  const successRate = stats.totalMoves > 0 
    ? ((stats.successfulMoves / stats.totalMoves) * 100).toFixed(1)
    : 0;
  
  const filteredKnowledge = selectedFilter === 'all' 
    ? knowledgeData 
    : knowledgeData.filter(k => k.decision_type === selectedFilter);
    
  // Find best cards/decisions - strategic analysis
  const bestDecisions = [...knowledgeData]
    .filter(k => k.card_played && k.reward > 0.5 && k.was_successful) // Only truly successful
    .sort((a, b) => {
      // Sort by reward, but prefer diverse strategies
      const rewardDiff = b.reward - a.reward;
      if (Math.abs(rewardDiff) < 0.1) {
        // If similar rewards, prefer different card types
        return 0;
      }
      return rewardDiff;
    })
    .slice(0, 15);
    
  // Get unique strategic patterns
  const uniqueStrategies = [];
  const seenPatterns = new Set();
  for (const decision of bestDecisions) {
    const pattern = `${decision.decision_type}_${Math.floor(decision.card_played.rank / 3)}`;
    if (!seenPatterns.has(pattern)) {
      seenPatterns.add(pattern);
      uniqueStrategies.push(decision);
      if (uniqueStrategies.length >= 10) break;
    }
  }
  
  const displayBest = uniqueStrategies.length > 0 ? uniqueStrategies : bestDecisions.slice(0, 10);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 max-w-6xl mx-auto">
        <Link to={createPageUrl('Home')}>
          <Button variant="ghost" className="text-slate-400 hover:text-white gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">AI Knowledge Base</h1>
        </div>
        
        <Link to={createPageUrl('Training')}>
          <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
            <Brain className="w-4 h-4" />
            Train AI
          </Button>
        </Link>
      </div>
      
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Overview Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-900/40 to-purple-800/30 border-purple-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <span className="text-xs text-purple-400">PERFORMANCE</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {currentData?.aha_score || 0}
              </div>
              <div className="text-sm text-slate-400">AHA Score</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/30 border-emerald-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Award className="w-5 h-5 text-emerald-400" />
                <span className="text-xs text-emerald-400">TRAINING</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {currentData?.games_played || 0}
              </div>
              <div className="text-sm text-slate-400">Games Played</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/30 border-blue-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-5 h-5 text-blue-400" />
                <span className="text-xs text-blue-400">SUCCESS</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {successRate}%
              </div>
              <div className="text-sm text-slate-400">Success Rate</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-900/40 to-amber-800/30 border-amber-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-5 h-5 text-amber-400" />
                <span className="text-xs text-amber-400">MOVES</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {stats.totalMoves}
              </div>
              <div className="text-sm text-slate-400">Total Moves</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Strategy Parameters */}
        {currentData?.strategy_weights && (
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Brain className="w-5 h-5 text-purple-400" />
                Current Strategy Parameters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Aggression Factor</span>
                    <span className="text-white font-bold">
                      {(currentData.strategy_weights.aggressive_factor * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500"
                      style={{ width: `${Math.min(100, currentData.strategy_weights.aggressive_factor * 50)}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Trump Conservation</span>
                    <span className="text-white font-bold">
                      {(currentData.strategy_weights.trump_conservation * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, currentData.strategy_weights.trump_conservation * 66)}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Card Value Threshold</span>
                    <span className="text-white font-bold">
                      {currentData.strategy_weights.card_value_threshold}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500"
                      style={{ width: `${(currentData.strategy_weights.card_value_threshold / 20) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Stats Section */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Stats
              </div>
              <div className="text-sm font-normal text-slate-400">
                Avg Reward: <span className="text-purple-400 font-bold">{stats.avgReward}</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-6 text-center">
                <div className="text-6xl font-bold text-red-400 mb-2">{stats.attackMoves}</div>
                <div className="text-sm text-slate-400">Attack Moves</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-6 text-center">
                <div className="text-6xl font-bold text-blue-400 mb-2">{stats.defenseMoves}</div>
                <div className="text-sm text-slate-400">Defense Moves</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-6 text-center">
                <div className="text-6xl font-bold text-emerald-400 mb-2">{stats.successfulMoves}</div>
                <div className="text-sm text-slate-400">Successful</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-6 text-center">
                <div className="text-6xl font-bold text-slate-400 mb-2">
                  {stats.totalMoves - stats.successfulMoves}
                </div>
                <div className="text-sm text-slate-400">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Best Cards Section */}
        <Card className="bg-gradient-to-br from-amber-900/40 to-amber-800/30 border-amber-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Award className="w-5 h-5 text-amber-400" />
              Best Strategic Plays - Expert Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayBest.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No successful card plays logged yet. Train more to see best decisions!
              </div>
            ) : (
              <div className="space-y-3">
                {displayBest.map((decision, idx) => {
                  const cardType = decision.card_played.rank >= 11 ? 'High Card' :
                                  decision.card_played.rank >= 9 ? 'Medium Card' : 'Low Card';
                  const strategyText = decision.decision_type === 'attack' 
                    ? (decision.move_number === 1 ? 'Opening attack' : 'Pressure attack')
                    : 'Strong defense';
                  
                  return (
                  <motion.div
                    key={decision.id}
                    className="bg-slate-800/50 rounded-lg p-4 border border-amber-600/30"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-amber-500/20 rounded-full w-10 h-10 flex items-center justify-center">
                          <span className="text-amber-400 font-bold">#{idx + 1}</span>
                        </div>
                        <div>
                          <div className="text-white font-bold text-lg mb-1">
                            {decision.card_played.rank} of {decision.card_played.suit}
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className={`${
                              decision.decision_type === 'attack' ? 'text-red-400' : 'text-blue-400'
                            }`}>
                              {decision.decision_type.toUpperCase()}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">Hand: {decision.hand_size} cards</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">Move #{decision.move_number}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-400">
                          +{decision.reward.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500">reward</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="text-xs text-slate-400">
                        <span className="text-amber-400 font-bold">Strategy:</span> {strategyText} with {cardType}.
                        {decision.reward > 0.8 && " 🔥 Elite execution! "}
                        {decision.decision_type === 'defense' && decision.reward > 0.7 && "Master defense technique. "}
                        {decision.hand_size <= 2 && "Critical endgame play. "}
                        Win rate: {(decision.reward * 100).toFixed(0)}%
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Recent Decisions */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Recent AI Decisions
              </div>
              <div className="flex gap-2">
                {['all', 'attack', 'defense', 'pass', 'take'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      selectedFilter === filter
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredKnowledge.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No knowledge data yet. Start training to collect data!
                </div>
              ) : (
                filteredKnowledge.slice(0, 50).map((knowledge, idx) => (
                  <motion.div
                    key={knowledge.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      knowledge.was_successful 
                        ? 'bg-emerald-900/20 border border-emerald-700/30' 
                        : 'bg-red-900/20 border border-red-700/30'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <div className="flex items-center gap-3">
                      {knowledge.decision_type === 'attack' && <Zap className="w-4 h-4 text-red-400" />}
                      {knowledge.decision_type === 'defense' && <Shield className="w-4 h-4 text-blue-400" />}
                      {knowledge.decision_type === 'pass' && <Target className="w-4 h-4 text-amber-400" />}
                      
                      <div>
                        <div className="text-sm text-white font-medium">
                          {knowledge.decision_type.charAt(0).toUpperCase() + knowledge.decision_type.slice(1)}
                          {knowledge.card_played && ` - ${knowledge.card_played.rank} of ${knowledge.card_played.suit}`}
                        </div>
                        <div className="text-xs text-slate-400">
                          Move #{knowledge.move_number} | Hand: {knowledge.hand_size} cards
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className={`text-sm font-mono ${
                        knowledge.reward > 0 ? 'text-emerald-400' : 
                        knowledge.reward < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {knowledge.reward > 0 ? '+' : ''}{(knowledge.reward || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500">
                        AHA: {knowledge.aha_score_at_time || 'N/A'}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="text-center text-slate-500 text-sm">
          <p>
            💡 The AI learns through reinforcement learning - tracking successful strategies and improving over time
          </p>
        </div>
      </div>
    </div>
  );
}