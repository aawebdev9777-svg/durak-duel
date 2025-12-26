import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Swords, 
  Users, 
  Trophy, 
  Brain, 
  ChevronRight,
  Crown,
  Sparkles,
  Database
} from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const suitSymbols = ['♠', '♥', '♦', '♣'];

export default function Home() {
  const [numPlayers, setNumPlayers] = useState(1);
  const [difficulty, setDifficulty] = useState('medium');
  // Load actual AHA score from database
  const { data: trainingData = [] } = useQuery({
    queryKey: ['aiTraining'],
    queryFn: () => base44.entities.AITrainingData.list(),
    initialData: []
  });
  
  const ahaScore = trainingData.length > 0 ? trainingData[0].aha_score : 25000;
  
  const difficulties = [
    { id: 'easy', label: 'Easy', description: 'For beginners' },
    { id: 'medium', label: 'Medium', description: 'Balanced challenge' },
    { id: 'hard', label: 'Hard', description: 'For experienced players' },
    { id: 'aha', label: 'AHA', description: 'Self-learning AI', special: true }
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {suitSymbols.map((suit, i) => (
          <motion.div
            key={i}
            className="absolute text-emerald-800/20 text-9xl select-none"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: -100,
              rotate: 0 
            }}
            animate={{ 
              y: window.innerHeight + 100,
              rotate: 360 
            }}
            transition={{ 
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              delay: i * 3,
              ease: "linear"
            }}
          >
            {suit}
          </motion.div>
        ))}
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-12 max-w-4xl">
        {/* Logo & Title */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-center gap-3 mb-4">
            {['♠', '♥', '♦', '♣'].map((suit, i) => (
              <motion.span
                key={suit}
                className={`text-4xl ${i % 2 === 0 ? 'text-slate-300' : 'text-red-500'}`}
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring" }}
              >
                {suit}
              </motion.span>
            ))}
          </div>
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-3 tracking-tight">
            ДУРАК
          </h1>
          <p className="text-xl text-emerald-400 font-medium tracking-widest uppercase">
            The Classic Russian Card Game
          </p>
        </motion.div>
        
        {/* Main Menu */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Play vs AI */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-emerald-500/20">
                    <Swords className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Play vs AI</h2>
                    <p className="text-sm text-slate-400">Challenge computer opponents</p>
                  </div>
                </div>
                
                {/* Number of Players */}
                <div className="mb-4">
                  <label className="text-sm text-slate-400 mb-2 block">Opponents</label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        onClick={() => setNumPlayers(n)}
                        className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                          numPlayers === n
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <Users className="w-4 h-4 inline mr-2" />
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Difficulty */}
                <div className="mb-6">
                  <label className="text-sm text-slate-400 mb-2 block">Difficulty</label>
                  <div className="grid grid-cols-2 gap-2">
                    {difficulties.map(d => (
                      <button
                        key={d.id}
                        onClick={() => setDifficulty(d.id)}
                        className={`py-2 px-3 rounded-lg border transition-all text-sm ${
                          difficulty === d.id
                            ? d.special 
                              ? 'bg-purple-500/20 border-purple-500 text-purple-400 font-bold'
                              : 'bg-amber-500/20 border-amber-500 text-amber-400'
                            : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {d.label}
                        {d.special && <span className="ml-1 text-xs">⚡</span>}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {difficulties.find(d => d.id === difficulty)?.description}
                  </p>
                </div>
                
                <Link to={createPageUrl(`Game?players=${numPlayers}&difficulty=${difficulty}`)}>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg gap-2">
                    Start Game
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* AHA AI Training Status */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-purple-900/30 to-slate-800/50 border-purple-700/50 backdrop-blur-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
              <CardContent className="p-6 relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-purple-500/20">
                    <Brain className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">AHA AI</h2>
                    <p className="text-sm text-purple-400/80">Self-Learning Neural Network</p>
                  </div>
                </div>
                
                <p className="text-slate-300 text-sm mb-4">
                  Train the AHA AI through self-play to create the ultimate Durak opponent. 
                  The more it trains, the stronger it becomes!
                </p>
                
                <div className="flex items-center gap-2 mb-2 text-purple-400/80 text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>AHA Score: {ahaScore.toLocaleString()}</span>
                </div>
                <div className="text-xs text-amber-400 mb-2 font-bold">
                  🏆 GRANDMASTER LEVEL - World's Strongest Durak AI
                </div>
                <div className="text-xs text-slate-500 mb-4">
                  Advanced probability engine + opening theory + endgame mastery
                </div>

                <Link to={createPageUrl('KnowledgeBase')} className="block">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white h-12 text-lg gap-2 border border-blue-500/50">
                    <Database className="w-5 h-5" />
                    View AI Knowledge
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
        

        
        {/* Rules hint */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-slate-500 text-sm">
            Don't know how to play? The goal is to get rid of all your cards.
            <br />
            The last player with cards is the "Durak" (fool)!
          </p>
        </motion.div>
      </div>
    </div>
  );
}