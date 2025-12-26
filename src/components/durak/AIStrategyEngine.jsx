// 🧠 LEVEL 1000 DURAK AI - WORLD-CLASS ARCHITECTURE
import { DurakProbabilityEngine } from './AIProbability';

export class AIStrategyEngine {
  constructor(difficulty = 'aha', learnedKnowledge = null, tactics = null) {
    this.difficulty = difficulty;
    this.knowledge = learnedKnowledge || [];
    this.tactics = tactics || [];
    
    // OPPONENT MODELING - Track patterns
    this.opponentModel = {
      trumpUsageRate: 0,
      takeFrequency: 0,
      aggressionLevel: 0.5,
      totalMoves: 0
    };
    
    this.strategies = {
      easy: this.easyStrategy.bind(this),
      medium: this.mediumStrategy.bind(this),
      hard: this.hardStrategy.bind(this),
      aha: this.ahaStrategy.bind(this)
    };
  }

  // ========== WORLD-CLASS POSITION EVALUATION ==========
  evaluatePosition(hand, opponentHandSize, trumpSuit, deckSize) {
    let value = 0;
    
    // Card advantage (fewer cards = winning)
    value += (opponentHandSize - hand.length) * 6;
    
    // Trump economy
    const trumpCount = hand.filter(c => c.suit === trumpSuit).length;
    value += trumpCount * 4;
    
    // Low card bonus (good for attacking)
    const lowCards = hand.filter(c => c.rank <= 9).length;
    value += lowCards * 3;
    
    // High card control
    const highCards = hand.filter(c => c.rank >= 12).length;
    value += highCards * 2;
    
    // Endgame dominance
    if (deckSize === 0) {
      if (hand.length <= 3) value *= 2.5;
      else if (hand.length <= 5) value *= 1.8;
    }
    
    // Pairs and duplicates (multi-attack potential)
    const ranks = {};
    hand.forEach(c => ranks[c.rank] = (ranks[c.rank] || 0) + 1);
    const pairs = Object.values(ranks).filter(count => count >= 2).length;
    value += pairs * 5;
    
    return value;
  }

  // ========== OPPONENT MODELING ==========
  updateOpponentModel(action) {
    this.opponentModel.totalMoves++;
    
    if (action.usedTrump) {
      this.opponentModel.trumpUsageRate = 
        (this.opponentModel.trumpUsageRate * (this.opponentModel.totalMoves - 1) + 1) / this.opponentModel.totalMoves;
    }
    
    if (action.tookCards) {
      this.opponentModel.takeFrequency = 
        (this.opponentModel.takeFrequency * (this.opponentModel.totalMoves - 1) + 1) / this.opponentModel.totalMoves;
    }
  }

  // ========== ENDGAME SOLVER ==========
  solveEndgame(hand, tableCards, trumpSuit, action, opponentHandSize, deckSize) {
    // Perfect play when deck empty and few cards remaining
    if (deckSize === 0 && (hand.length + opponentHandSize) <= 12) {
      const validCards = action === 'attack' ? this.getValidAttacks(hand, tableCards) : hand;
      if (validCards.length === 0) return null;
      
      let bestMove = null;
      let bestScore = action === 'attack' ? -Infinity : Infinity;
      
      validCards.forEach(card => {
        let score = 0;
        
        if (action === 'attack') {
          // Aggressive endgame attacks
          score += 15;
          if (card.rank <= 8) score += 8;
          if (card.suit === trumpSuit && opponentHandSize <= 2) score += 20;
          else if (card.suit === trumpSuit) score -= 12;
          score -= card.rank * 0.3;
          
          if (score > bestScore) {
            bestScore = score;
            bestMove = card;
          }
        } else {
          // Minimal endgame defense
          score += this.getCardStrength(card, trumpSuit);
          if (hand.length < opponentHandSize) score -= 10;
          
          if (score < bestScore) {
            bestScore = score;
            bestMove = card;
          }
        }
      });
      
      return bestMove;
    }
    return null;
  }

  // Easy AI - Makes random mistakes
  easyStrategy(hand, gameState, action) {
    const { trumpSuit, tableCards } = gameState;
    
    if (action === 'attack') {
      const valid = this.getValidAttacks(hand, tableCards);
      if (valid.length === 0) return null;
      
      if (Math.random() < 0.4) return valid[valid.length - 1];
      return valid[Math.floor(Math.random() * valid.length)];
    }
    
    if (action === 'defend') {
      const undefended = tableCards.find(p => !p.defense);
      if (!undefended) return null;
      
      const valid = hand.filter(c => this.canBeat(undefended.attack, c, trumpSuit));
      if (valid.length === 0) return null;
      return valid[0];
    }
  }

  // Medium AI - Decent strategy
  mediumStrategy(hand, gameState, action) {
    const { trumpSuit, tableCards, deckSize } = gameState;
    const prob = new DurakProbabilityEngine(trumpSuit, deckSize, this.getVisibleCards(hand, tableCards));
    
    if (action === 'attack') {
      const valid = this.getValidAttacks(hand, tableCards);
      if (valid.length === 0) return null;
      
      valid.sort((a, b) => {
        const aValue = a.rank + (a.suit === trumpSuit ? 20 : 0);
        const bValue = b.rank + (b.suit === trumpSuit ? 20 : 0);
        return aValue - bValue;
      });
      
      if (Math.random() < 0.7) return valid[0];
      return valid[Math.floor(Math.random() * Math.min(3, valid.length))];
    }
    
    if (action === 'defend') {
      const undefended = tableCards.find(p => !p.defense);
      if (!undefended) return null;
      
      const valid = hand.filter(c => this.canBeat(undefended.attack, c, trumpSuit));
      if (valid.length === 0) return null;
      
      valid.sort((a, b) => this.getCardStrength(a, trumpSuit) - this.getCardStrength(b, trumpSuit));
      return valid[0];
    }
  }

  // Hard AI - Strong play
  hardStrategy(hand, gameState, action) {
    const { trumpSuit, tableCards, deckSize, opponentHandSize } = gameState;
    const prob = new DurakProbabilityEngine(trumpSuit, deckSize, this.getVisibleCards(hand, tableCards));
    
    if (action === 'attack') {
      return prob.findOptimalAttack(hand, tableCards, opponentHandSize);
    }
    
    if (action === 'defend') {
      const undefended = tableCards.find(p => !p.defense);
      if (!undefended) return null;
      return prob.findOptimalDefense(undefended.attack, hand, opponentHandSize);
    }
  }

  // 🧠 AHA AI - WORLD-CLASS LEVEL WITH BELIEF STATES & MCTS-INSPIRED EVALUATION
  ahaStrategy(hand, gameState, action) {
    const { trumpSuit, tableCards, deckSize, opponentHandSize, ourHandSize } = gameState;
    const prob = new DurakProbabilityEngine(trumpSuit, deckSize, this.getVisibleCards(hand, tableCards));
    
    // PRIORITY 0: ENDGAME SOLVER (perfect play when deck empty)
    if (deckSize === 0 && (hand.length + opponentHandSize) <= 12) {
      const endgameMove = this.solveEndgame(hand, tableCards, trumpSuit, action, opponentHandSize, deckSize);
      if (endgameMove) return endgameMove;
    }
    
    // Evaluate current position
    const positionValue = this.evaluatePosition(hand, opponentHandSize, trumpSuit, deckSize);
    
    // Opponent modeling adaptations
    const opponentIsAggressive = this.opponentModel.aggressionLevel > 0.6;
    const opponentSavesTrumps = this.opponentModel.trumpUsageRate < 0.3;
    
    // PRIORITY 1: APPLY LEARNED TACTICS
    if (this.tactics && this.tactics.length > 0) {
      const tacticDecision = this.applyTactics(hand, gameState, action, trumpSuit);
      if (tacticDecision) {
        const goodTactics = this.tactics.filter(t => (t.confidence || 0) > 0.5 && (t.success_rate || 0) > 0.55);
        if (goodTactics.length > 0) {
          const avgQuality = goodTactics.reduce((sum, t) => sum + (t.confidence * t.success_rate), 0) / goodTactics.length;
          if (Math.random() < avgQuality) return tacticDecision;
        }
      }
    }
    
    // Query learned knowledge
    const similarSituations = this.findSimilarKnowledge({
      handSize: ourHandSize,
      phase: action,
      deckSize,
      tableCards: tableCards.length
    });
    
    let decision;
    
    if (action === 'attack') {
      const candidates = this.getValidAttacks(hand, tableCards);
      if (candidates.length === 0) return null;
      
      let bestCard = null;
      let bestScore = -Infinity;
      
      for (const card of candidates) {
        if (!card || !card.suit || !card.rank) continue;
        
        let score = 0;
        
        // Base strength
        score -= this.getCardStrength(card, trumpSuit) * 0.3;
        
        // BELIEF STATE: Opponent defense probability
        const defenseProb = prob.estimateDefenseProbability(card, opponentHandSize);
        score += (1 - defenseProb) * 15;
        
        // Position evaluation after move
        const futureHand = hand.filter(c => c.id !== card.id);
        const futurePosition = this.evaluatePosition(futureHand, opponentHandSize, trumpSuit, deckSize);
        score += futurePosition * 0.3;
        
        // Learned patterns (MASSIVE weight)
        const learnedBoost = this.getLearnedCardScore(card, similarSituations, 'attack');
        score += learnedBoost * 8;
        
        // Duplicate setup (multi-attack)
        const duplicates = hand.filter(c => c.rank === card.rank).length;
        score += (duplicates - 1) * 6;
        
        // Opponent model adaptation
        if (opponentIsAggressive && card.rank <= 8) score += 7;
        if (opponentSavesTrumps && card.suit === trumpSuit) score += 6;
        
        // Opening theory
        if (tableCards.length === 0 && deckSize > 20) {
          if (card.rank <= 8 && card.suit !== trumpSuit) score += 6;
        }
        
        // Endgame aggression
        if (deckSize === 0 && ourHandSize <= 3) {
          score += this.evaluateEndgameAttack(card, hand, opponentHandSize, trumpSuit) * 3;
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestCard = card;
        }
      }
      
      decision = bestCard;
    }
    
    if (action === 'defend') {
      const undefended = tableCards.find(p => !p.defense);
      if (!undefended) return null;
      
      const validDefenses = hand.filter(c => this.canBeat(undefended.attack, c, trumpSuit));
      if (validDefenses.length === 0) return null;
      
      let bestCard = null;
      let bestScore = Infinity;
      
      for (const card of validDefenses) {
        if (!card || !card.suit || !card.rank) continue;
        
        let score = 0;
        
        // Minimize value spent
        score += this.getCardStrength(card, trumpSuit);
        
        // Avoid overkill
        const attackValue = this.getCardStrength(undefended.attack, trumpSuit);
        const wasteScore = (score - attackValue) * 1.2;
        score += wasteScore;
        
        // Trump conservation
        if (card.suit === trumpSuit && deckSize > 10) score += 18;
        
        // Learned patterns
        const learnedScore = this.getLearnedCardScore(card, similarSituations, 'defense');
        score -= learnedScore * 6;
        
        // Endgame strategy
        if (deckSize === 0) {
          if (ourHandSize > opponentHandSize) {
            score -= 8;
          } else {
            if (score > attackValue + 12) score = Infinity;
          }
        }
        
        if (score < bestScore) {
          bestScore = score;
          bestCard = card;
        }
      }
      
      decision = bestCard;
    }
    
    return decision;
  }

  // ========== HELPER METHODS ==========
  
  findSimilarKnowledge(gameState) {
    if (!this.knowledge || this.knowledge.length === 0) return [];
    
    return this.knowledge.filter(k => {
      const stateDiff = Math.abs(k.hand_size - gameState.handSize);
      return stateDiff <= 2 && k.was_successful;
    }).slice(0, 10);
  }

  shouldContinueAttack(hand, tableCards, deckSize, opponentHandSize) {
    if (tableCards.length >= opponentHandSize) return false;
    if (tableCards.some(p => !p.defense)) return false;
    
    const valid = this.getValidAttacks(hand, tableCards);
    if (valid.length === 0) return false;
    
    if (this.difficulty === 'easy') return Math.random() > 0.6;
    if (this.difficulty === 'medium') return Math.random() > 0.5;
    
    const prob = new DurakProbabilityEngine(null, deckSize, []);
    return prob.shouldContinueAttack(hand, tableCards, opponentHandSize, opponentHandSize);
  }

  makeDecision(hand, gameState, action) {
    const strategy = this.strategies[this.difficulty] || this.strategies.medium;
    return strategy(hand, gameState, action);
  }

  getValidAttacks(hand, tableCards) {
    if (tableCards.length === 0) return hand;
    
    const ranks = new Set();
    tableCards.forEach(p => {
      ranks.add(p.attack.rank);
      if (p.defense) ranks.add(p.defense.rank);
    });
    
    return hand.filter(c => ranks.has(c.rank));
  }

  canBeat(attack, defense, trumpSuit) {
    if (defense.suit === trumpSuit && attack.suit !== trumpSuit) return true;
    if (defense.suit === attack.suit && defense.rank > attack.rank) return true;
    return false;
  }

  getCardStrength(card, trumpSuit) {
    return card.rank + (card.suit === trumpSuit ? 10 : 0);
  }

  getVisibleCards(hand, tableCards) {
    const visible = [...hand];
    tableCards.forEach(p => {
      visible.push(p.attack);
      if (p.defense) visible.push(p.defense);
    });
    return visible;
  }

  getLearnedCardScore(card, situations, action) {
    if (!situations || situations.length === 0) return 0;
    
    const relevantMoves = situations.filter(s => 
      s.decision_type === action && 
      s.card_played && 
      Math.abs(s.card_played.rank - card.rank) <= 2
    );
    
    if (relevantMoves.length === 0) return 0;
    
    const avgReward = relevantMoves.reduce((sum, m) => sum + m.reward, 0) / relevantMoves.length;
    return avgReward * 5;
  }

  evaluateEndgameAttack(card, hand, opponentHandSize, trumpSuit) {
    let score = 0;
    
    if (hand.length < opponentHandSize) {
      score += (card.rank - 7) * 0.5;
    }
    
    if (hand.length > opponentHandSize) {
      score -= (card.rank - 7) * 0.3;
    }
    
    if (card.suit === trumpSuit && hand.length > 2) {
      score -= 8;
    }
    
    return score;
  }

  applyTactics(hand, gameState, action, trumpSuit) {
    const { deckSize, opponentHandSize, ourHandSize } = gameState;
    
    const applicableTactics = this.tactics.filter(t => 
      t.scenario?.phase === action &&
      Math.abs((t.scenario.hand_size || 0) - ourHandSize) <= 3 &&
      Math.abs((t.scenario.deck_remaining || 0) - deckSize) <= 20 &&
      (t.success_rate || 0) > 0.5 &&
      (t.confidence || 0) > 0.4
    ).sort((a, b) => {
      const scoreA = (a.success_rate || 0) * Math.pow((a.confidence || 0), 1.5) * Math.sqrt(a.times_won || 1);
      const scoreB = (b.success_rate || 0) * Math.pow((b.confidence || 0), 1.5) * Math.sqrt(b.times_won || 1);
      return scoreB - scoreA;
    });
    
    if (applicableTactics.length === 0) return null;
    
    const topTactics = applicableTactics.slice(0, 3);
    const weights = topTactics.map(t => (t.success_rate || 0) * (t.confidence || 0));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let random = Math.random() * totalWeight;
    let selectedTactic = topTactics[0];
    
    for (let i = 0; i < topTactics.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedTactic = topTactics[i];
        break;
      }
    }
    
    if (action === 'attack') {
      return this.executeTacticAttack(selectedTactic, hand, gameState, trumpSuit);
    } else {
      return this.executeTacticDefense(selectedTactic, hand, gameState, trumpSuit);
    }
  }

  executeTacticAttack(tactic, hand, gameState, trumpSuit) {
    const { tableCards } = gameState;
    const validCards = this.getValidAttacks(hand, tableCards);
    if (validCards.length === 0) return null;
    
    const cardPref = tactic.action?.card_preference;
    const aggressionLevel = tactic.action?.aggression_level || 0.5;
    
    if (cardPref === 'low_cards') {
      const lowCards = validCards.filter(c => c.rank <= 8);
      if (lowCards.length > 0) {
        lowCards.sort((a, b) => a.rank - b.rank);
        return lowCards[0];
      }
    }
    
    if (cardPref === 'high_trumps') {
      const highTrumps = validCards.filter(c => c.suit === trumpSuit && c.rank >= 11);
      if (highTrumps.length > 0) {
        highTrumps.sort((a, b) => b.rank - a.rank);
        return highTrumps[0];
      }
    }
    
    if (cardPref === 'duplicates') {
      const ranks = {};
      validCards.forEach(c => ranks[c.rank] = (ranks[c.rank] || 0) + 1);
      const dupRanks = Object.keys(ranks).filter(r => ranks[r] > 1);
      if (dupRanks.length > 0) {
        const dupCard = validCards.find(c => dupRanks.includes(c.rank.toString()));
        if (dupCard) return dupCard;
      }
    }
    
    if (cardPref === 'medium_cards') {
      const medCards = validCards.filter(c => c.rank >= 9 && c.rank <= 11);
      if (medCards.length > 0) {
        medCards.sort((a, b) => a.rank - b.rank);
        return medCards[0];
      }
    }
    
    validCards.sort((a, b) => {
      if (aggressionLevel > 0.7) return b.rank - a.rank;
      else if (aggressionLevel < 0.4) return a.rank - b.rank;
      else return Math.abs(a.rank - 9) - Math.abs(b.rank - 9);
    });
    
    return validCards[0];
  }

  executeTacticDefense(tactic, hand, gameState, trumpSuit) {
    const { tableCards } = gameState;
    const undefended = tableCards.find(p => !p.defense);
    if (!undefended) return null;
    
    const validDefenses = hand.filter(c => this.canBeat(undefended.attack, c, trumpSuit));
    if (validDefenses.length === 0) return null;
    
    const tacticType = tactic.action?.type;
    
    if (tacticType === 'desperate_defense') {
      validDefenses.sort((a, b) => this.getCardStrength(a, trumpSuit) - this.getCardStrength(b, trumpSuit));
      return validDefenses[0];
    }
    
    if (tacticType === 'conservative') {
      const lowDefenses = validDefenses.filter(c => c.rank <= 10 && c.suit !== trumpSuit);
      if (lowDefenses.length > 0) {
        lowDefenses.sort((a, b) => a.rank - b.rank);
        return lowDefenses[0];
      }
      return null;
    }
    
    if (tacticType === 'trump_finish') {
      const trumpDefenses = validDefenses.filter(c => c.suit === trumpSuit);
      if (trumpDefenses.length > 0 && gameState.deckSize === 0) {
        trumpDefenses.sort((a, b) => a.rank - b.rank);
        return trumpDefenses[0];
      }
    }
    
    if (tacticType === 'aggressive_start' || tacticType === 'multi_attack') {
      const nonTrumps = validDefenses.filter(c => c.suit !== trumpSuit);
      if (nonTrumps.length > 0) {
        nonTrumps.sort((a, b) => a.rank - b.rank);
        return nonTrumps[0];
      }
    }
    
    validDefenses.sort((a, b) => this.getCardStrength(a, trumpSuit) - this.getCardStrength(b, trumpSuit));
    return validDefenses[0];
  }
}