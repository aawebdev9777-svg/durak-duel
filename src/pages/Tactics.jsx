import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Brain,
  Target,
  Shield,
  Zap,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Tactics() {
  const [filter, setFilter] = useState('all');
  
  const { data: tactics = [] } = useQuery({
    queryKey: ['ahaTactics'],
    queryFn: () => base44.entities.AHATactic.list('-success_rate', 1000),
    initialData: []
  });
  
  const filteredTactics = filter === 'all' 
    ? tactics 
    : tactics.filter(t => t.scenario?.phase === filter);
  
  const avgSuccessRate = tactics.length > 0
    ? (tactics.reduce((sum, t) => sum + (t.success_rate || 0), 0) / tactics.length * 100).toFixed(1)
    : 0;
    
  const totalUsage = tactics.reduce((sum, t) => sum + (t.times_used || 0), 0);
  
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
          <Brain className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">AHA Tactics</h1>
        </div>
        
        <Link to={createPageUrl('AIBattle')}>
          <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
            <Zap className="w-4 h-4" />
            Battle Arena
          </Button>
        </Link>
      </div>
      
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-amber-900/40 to-amber-800/30 border-amber-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Brain className="w-5 h-5 text-amber-400" />
                <span className="text-xs text-amber-400">TACTICS</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{tactics.length}</div>
              <div className="text-sm text-slate-400">Learned Strategies</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/30 border-emerald-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-xs text-emerald-400">SUCCESS</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{avgSuccessRate}%</div>
              <div className="text-sm text-slate-400">Avg Win Rate</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/30 border-blue-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-5 h-5 text-blue-400" />
                <span className="text-xs text-blue-400">USAGE</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{totalUsage}</div>
              <div className="text-sm text-slate-400">Times Applied</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex gap-2">
              {['all', 'attack', 'defend'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    filter === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Tactics Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTactics.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">
              No tactics learned yet. Run battles to train the AI!
            </div>
          ) : (
            filteredTactics.map((tactic, idx) => (
              <motion.div
                key={tactic.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card className="bg-slate-800/50 border-slate-700/50 hover:border-amber-500/50 transition-all">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-white text-base">
                      <div className="flex items-center gap-2">
                        {tactic.scenario?.phase === 'attack' ? (
                          <Zap className="w-4 h-4 text-red-400" />
                        ) : (
                          <Shield className="w-4 h-4 text-blue-400" />
                        )}
                        <span className="text-amber-400">{tactic.tactic_name}</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Scenario */}
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-2">Scenario:</div>
                      <div className="text-xs text-slate-300 space-y-1">
                        <div>Hand: {tactic.scenario?.hand_size || 'Any'} cards</div>
                        <div>Opponent: {tactic.scenario?.opponent_hand_size || 'Any'} cards</div>
                        <div>Deck: {tactic.scenario?.deck_remaining || 0} remaining</div>
                        <div className="capitalize">Phase: {tactic.scenario?.phase || 'Any'}</div>
                      </div>
                    </div>
                    
                    {/* Action */}
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-2">Action:</div>
                      <div className="text-xs text-slate-300 space-y-1">
                        <div className="text-purple-400 font-medium">{tactic.action?.type || 'Unknown'}</div>
                        <div>Cards: {tactic.action?.card_preference || 'Any'}</div>
                        <div>Aggression: {((tactic.action?.aggression_level || 0) * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                      <div>
                        <div className="text-emerald-400 font-bold text-sm">
                          {((tactic.success_rate || 0) * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-slate-500">Win Rate</div>
                      </div>
                      <div>
                        <div className="text-blue-400 font-bold text-sm">
                          {tactic.times_won || 0}/{tactic.times_used || 0}
                        </div>
                        <div className="text-xs text-slate-500">W/L</div>
                      </div>
                      <div>
                        <div className="text-amber-400 font-bold text-sm">
                          {((tactic.confidence || 0) * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-slate-500">Confidence</div>
                      </div>
                    </div>
                    
                    {/* Confidence Bar */}
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400"
                        style={{ width: `${(tactic.confidence || 0) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
        
        <div className="text-center text-slate-500 text-sm">
          💡 Tactics are learned from every battle - wins reinforce strategies, losses teach new approaches
        </div>
      </div>
    </div>
  );
}