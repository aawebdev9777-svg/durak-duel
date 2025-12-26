// MASTER AI STRATEGY ENGINE - MULTIPLE PLAY STYLES AND ADAPTIVE LEARNING
import { DurakProbabilityEngine } from './AIProbability';

export class AIStrategyEngine {
  constructor(difficulty = 'aha', learnedKnowledge = null, tactics = null) {
    this.difficulty = difficulty;
    this.knowledge = learnedKnowledge || [];
    this.tactics = tactics || [];
    this.strategies = {
      easy: this.easyStrategy.bind(this),
      medium: this.mediumStrategy.bind(this),
      hard: this.hardStrategy.bind(this),
      aha: this.ahaStrategy.bind(this)
    };
  }

  // Easy AI - Makes random mistakes, plays poorly
  easyStrategy(hand, gameState, action) {
    const { trumpSuit, tableCards, opponentHandSize } = gameState;
    
    if (action === 'attack') {
      const valid = this.getValidAttacks(hand, tableCards);
      if (valid.length === 0) return null;
      
      // 40% chance to pick worst card
      if (Math.random() < 0.4) {
        return valid[valid.length - 1];
      }
      return valid[Math.floor(Math.random() * valid.length)];
    }
    
    if (action === 'defend') {
      const undefended = tableCards.find(p => !p.defense);
      if (!undefended) return null;
      
      const valid = hand.filter(c => this.canBeat(undefended.attack, c, trumpSuit));
      if (valid.length === 0) return null;
      
      // Often uses first valid card (not optimal)
      return valid[0];
    }
  }

  // Medium AI - Decent strategy, some mistakes
  mediumStrategy(hand, gameState, action) {
    const { trumpSuit, tableCards, deckSize } = gameState;
    const prob = new DurakProbabilityEngine(trumpSuit, deckSize, this.getVisibleCards(hand, tableCards));
    
    if (action === 'attack') {
      const valid = this.getValidAttacks(hand, tableCards);
      if (valid.length === 0) return null;
      
      // Prefer low cards, avoid trumps
      valid.sort((a, b) => {
        const aValue = a.rank + (a.suit === trumpSuit ? 20 : 0);
        const bValue = b.rank + (b.suit === trumpSuit ? 20 : 0);
        return aValue - bValue;
      });
      
      // 70% optimal, 30% suboptimal
      if (Math.random() < 0.7) {
        return valid[0];
      }
      return valid[Math.floor(Math.random() * Math.min(3, valid.length))];
    }
    
    if (action === 'defend') {
      const undefended = tableCards.find(p => !p.defense);
      if (!undefended) return null;
      
      const valid = hand.filter(c => this.canBeat(undefended.attack, c, trumpSuit));
      if (valid.length === 0) return null;
      
      // Try to use minimal card
      valid.sort((a, b) => {
        const aValue = this.getCardStrength(a, trumpSuit);
        const bValue = this.getCardStrength(b, trumpSuit);
        return aValue - bValue;
      });
      
      return valid[0];
    }
  }

  // Hard AI - Strong strategy, rare mistakes
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

  // AHA AI - Minimax-inspired evaluation with MCTS simulation + learned patterns + TACTICS
  ahaStrategy(hand, gameState, action) {
    const { trumpSuit, tableCards, deckSize, opponentHandSize, ourHandSize } = gameState;
    const prob = new DurakProbabilityEngine(trumpSuit, deckSize, this.getVisibleCards(hand, tableCards));
    
    // PRIORITY 1: APPLY LEARNED TACTICS (95% priority for high confidence tactics)
    if (this.tactics && this.tactics.length > 0) {
      const tacticDecision = this.applyTactics(hand, gameState, action, trumpSuit);
      if (tacticDecision) {
        // Use tactics more aggressively based on their quality
        const highConfidenceTactics = this.tactics.filter(t => (t.confidence || 0) > 0.6 && (t.success_rate || 0) > 0.6);
        const useRate = highConfidenceTactics.length > 3 ? 0.95 : 0.85;
        if (Math.random() < useRate) {
          return tacticDecision;
        }
      }
    }
    
    // Query learned knowledge for similar situations
    const similarSituations = this.findSimilarKnowledge({
      handSize: ourHandSize,
      phase: action,
      deckSize,
      tableCards: tableCards.length
    });
    
    let decision;
    
    if (action === 'attack') {
      // Minimax-style evaluation: consider opponent's likely defenses
      const candidates = this.getValidAttacks(hand, tableCards);
      if (candidates.length === 0) return null;
      
      // Score each attack based on multiple factors
      let bestCard = null;
      let bestScore = -Infinity;
      
      for (const card of candidates) {
        if (!card || !card.suit || !card.rank) continue;
        
        let score = 0;
        
        // 1. Card value (lower is better for attack)
        score -= this.getCardStrength(card, trumpSuit) * 0.5;
        
        // 2. Opponent's defense probability (from MCTS simulation)
        const defenseProb = prob.estimateDefenseProbability(card, opponentHandSize);
        score += (1 - defenseProb) * 10; // Higher if opponent can't defend
        
        // 3. Learned patterns boost
        const learnedBoost = this.getLearnedCardScore(card, similarSituations, 'attack');
        score += learnedBoost * 5;
        
        // 4. Duplicate rank bonus (setup for multi-attack)
        const duplicates = hand.filter(c => c.rank === card.rank).length;
        score += (duplicates - 1) * 3;
        
        // 5. Greedy endgame strategy
        if (deckSize === 0 && ourHandSize <= 3) {
          score += this.evaluateEndgameAttack(card, hand, opponentHandSize, trumpSuit);
        }
        
        // 6. Opening theory
        if (tableCards.length === 0 && deckSize > 20) {
          if (card.rank <= 8 && card.suit !== trumpSuit) score += 5;
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
      
      // Minimax evaluation: choose minimal defense while considering future
      let bestCard = null;
      let bestScore = Infinity;
      
      for (const card of validDefenses) {
        if (!card || !card.suit || !card.rank) continue;
        
        let score = 0;
        
        // 1. Minimize card value spent
        score += this.getCardStrength(card, trumpSuit);
        
        // 2. Consider attack value vs defense value
        const attackValue = this.getCardStrength(undefended.attack, trumpSuit);
        const wasteScore = (score - attackValue) * 0.8;
        score += wasteScore;
        
        // 3. Trump conservation in early/mid game
        if (card.suit === trumpSuit && deckSize > 10) {
          score += 15;
        }
        
        // 4. Learned pattern penalty/bonus
        const learnedScore = this.getLearnedCardScore(card, similarSituations, 'defense');
        score -= learnedScore * 4;
        
        // 5. Endgame considerations
        if (deckSize === 0) {
          if (ourHandSize > opponentHandSize) {
            // We're losing - be aggressive with defense
            score -= 5;
          } else {
            // We're winning - take strategically if card too valuable
            if (score > attackValue + 10) score = Infinity; // Consider taking
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

  // Advanced opening theory
  applyOpeningTheory(hand, trumpSuit, deckSize, opponentHandSize) {
    const nonTrumps = hand.filter(c => c.suit !== trumpSuit);
    const lowCards = hand.filter(c => c.rank <= 8);
    
    // Early game: Start with lowest non-trump
    if (deckSize > 20) {
      if (lowCards.length > 0) {
        lowCards.sort((a, b) => a.rank - b.rank);
        return lowCards[0];
      }
    }
    
    // Mid game: Use duplicates or medium cards
    if (deckSize > 10) {
      const duplicates = this.findDuplicates(hand);
      if (duplicates.length > 0) return duplicates[0];
      
      const mediumCards = hand.filter(c => c.rank >= 9 && c.rank <= 11);
      if (mediumCards.length > 0) return mediumCards[0];
    }
    
    // Endgame: Be aggressive
    hand.sort((a, b) => {
      const aVal = a.rank + (a.suit === trumpSuit ? 5 : 0);
      const bVal = b.rank + (b.suit === trumpSuit ? 5 : 0);
      return bVal - aVal;
    });
    return hand[0];
  }

  // Advanced endgame theory
  applyEndgameTheory(hand, opponentHandSize, trumpSuit) {
    const trumps = hand.filter(c => c.suit === trumpSuit);
    const nonTrumps = hand.filter(c => c.suit !== trumpSuit);
    
    // If we have fewer cards, play highest to pressure
    if (hand.length < opponentHandSize) {
      hand.sort((a, b) => b.rank - a.rank);
      return hand[0];
    }
    
    // If equal or more, play medium cards
    if (nonTrumps.length > 0) {
      nonTrumps.sort((a, b) => a.rank - b.rank);
      return nonTrumps[Math.floor(nonTrumps.length / 2)];
    }
    
    return hand[0];
  }

  // Find duplicate ranks for setup attacks
  findDuplicates(hand) {
    const ranks = {};
    hand.forEach(c => {
      if (!ranks[c.rank]) ranks[c.rank] = [];
      ranks[c.rank].push(c);
    });
    
    const duplicates = [];
    Object.values(ranks).forEach(cards => {
      if (cards.length > 1) duplicates.push(...cards);
    });
    
    return duplicates;
  }

  // Query learned knowledge
  findSimilarKnowledge(gameState) {
    if (!this.knowledge || this.knowledge.length === 0) return [];
    
    return this.knowledge.filter(k => {
      const stateDiff = Math.abs(k.hand_size - gameState.handSize);
      return stateDiff <= 2 && k.was_successful;
    }).slice(0, 10);
  }

  // Apply patterns from learned games
  applyLearnedPatterns(hand, situations, action) {
    const successfulMoves = situations.filter(s => s.was_successful && s.card_played);
    if (successfulMoves.length === 0) return null;
    
    // Find cards in hand that match learned successful patterns
    for (const move of successfulMoves) {
      const matchingCard = hand.find(c => 
        Math.abs(c.rank - move.card_played.rank) <= 1
      );
      if (matchingCard) return matchingCard;
    }
    
    return null;
  }

  // Should AI continue attacking?
  shouldContinueAttack(hand, tableCards, deckSize, opponentHandSize) {
    if (tableCards.length >= opponentHandSize) return false;
    if (tableCards.some(p => !p.defense)) return false;
    
    const valid = this.getValidAttacks(hand, tableCards);
    if (valid.length === 0) return false;
    
    if (this.difficulty === 'easy') return Math.random() > 0.6;
    if (this.difficulty === 'medium') return Math.random() > 0.5;
    
    // Hard/AHA use probability
    const prob = new DurakProbabilityEngine(null, deckSize, []);
    return prob.shouldContinueAttack(hand, tableCards, opponentHandSize, opponentHandSize);
  }

  // Make decision based on difficulty
  makeDecision(hand, gameState, action) {
    const strategy = this.strategies[this.difficulty] || this.strategies.medium;
    return strategy(hand, gameState, action);
  }

  // Helper methods
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

  // Get learned score for a card from knowledge base
  getLearnedCardScore(card, situations, action) {
    if (!situations || situations.length === 0) return 0;
    
    const relevantMoves = situations.filter(s => 
      s.decision_type === action && 
      s.card_played && 
      Math.abs(s.card_played.rank - card.rank) <= 2
    );
    
    if (relevantMoves.length === 0) return 0;
    
    const avgReward = relevantMoves.reduce((sum, m) => sum + m.reward, 0) / relevantMoves.length;
    return avgReward * 5; // Scale up the learned score
  }

  // Evaluate endgame attack move
  evaluateEndgameAttack(card, hand, opponentHandSize, trumpSuit) {
    let score = 0;
    
    // If we have fewer cards, be aggressive with high cards
    if (hand.length < opponentHandSize) {
      score += (card.rank - 7) * 0.5;
    }
    
    // If we're ahead, use low cards
    if (hand.length > opponentHandSize) {
      score -= (card.rank - 7) * 0.3;
    }
    
    // Never waste trumps in endgame if not necessary
    if (card.suit === trumpSuit && hand.length > 2) {
      score -= 8;
    }
    
    return score;
  }

  // APPLY LEARNED TACTICS - Main decision engine
  applyTactics(hand, gameState, action, trumpSuit) {
    const { deckSize, opponentHandSize, ourHandSize } = gameState;
    
    // Find applicable tactics sorted by success rate and confidence
    const applicableTactics = this.tactics.filter(t => 
      t.scenario?.phase === action &&
      Math.abs((t.scenario.hand_size || 0) - ourHandSize) <= 3 &&
      Math.abs((t.scenario.deck_remaining || 0) - deckSize) <= 20 &&
      (t.success_rate || 0) > 0.35 &&
      (t.confidence || 0) > 0.2
    ).sort((a, b) => {
      // Heavily weight recent wins and confidence
      const scoreA = (a.success_rate || 0) * Math.pow((a.confidence || 0), 1.5) * Math.sqrt(a.times_won || 1);
      const scoreB = (b.success_rate || 0) * Math.pow((b.confidence || 0), 1.5) * Math.sqrt(b.times_won || 1);
      return scoreB - scoreA;
    });
    
    if (applicableTactics.length === 0) return null;
    
    // Use top 3 tactics with weighted random selection
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

  // Execute attack tactic
  executeTacticAttack(tactic, hand, gameState, trumpSuit) {
    const { tableCards } = gameState;
    const validCards = this.getValidAttacks(hand, tableCards);
    if (validCards.length === 0) return null;
    
    const cardPref = tactic.action?.card_preference;
    const aggressionLevel = tactic.action?.aggression_level || 0.5;
    
    // Card preference strategy
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
      validCards.forEach(c => {
        ranks[c.rank] = (ranks[c.rank] || 0) + 1;
      });
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
    
    // Aggression-based selection
    validCards.sort((a, b) => {
      if (aggressionLevel > 0.7) {
        return b.rank - a.rank; // High cards for aggressive
      } else if (aggressionLevel < 0.4) {
        return a.rank - b.rank; // Low cards for conservative
      } else {
        return Math.abs(a.rank - 9) - Math.abs(b.rank - 9); // Medium cards
      }
    });
    
    return validCards[0];
  }

  // Execute defense tactic
  executeTacticDefense(tactic, hand, gameState, trumpSuit) {
    const { tableCards } = gameState;
    const undefended = tableCards.find(p => !p.defense);
    if (!undefended) return null;
    
    const validDefenses = hand.filter(c => this.canBeat(undefended.attack, c, trumpSuit));
    if (validDefenses.length === 0) return null;
    
    const tacticType = tactic.action?.type;
    
    // Execute based on tactic type
    if (tacticType === 'desperate_defense') {
      // Use any valid defense, minimal cost
      validDefenses.sort((a, b) => this.getCardStrength(a, trumpSuit) - this.getCardStrength(b, trumpSuit));
      return validDefenses[0];
    }
    
    if (tacticType === 'conservative') {
      // Only defend with low value cards, otherwise take
      const lowDefenses = validDefenses.filter(c => c.rank <= 10 && c.suit !== trumpSuit);
      if (lowDefenses.length > 0) {
        lowDefenses.sort((a, b) => a.rank - b.rank);
        return lowDefenses[0];
      }
      return null; // Take cards if no low defense
    }
    
    if (tacticType === 'trump_finish') {
      // Use trumps aggressively in endgame
      const trumpDefenses = validDefenses.filter(c => c.suit === trumpSuit);
      if (trumpDefenses.length > 0 && gameState.deckSize === 0) {
        trumpDefenses.sort((a, b) => a.rank - b.rank);
        return trumpDefenses[0];
      }
    }
    
    if (tacticType === 'aggressive_start' || tacticType === 'multi_attack') {
      // Defend minimally to keep hand strong
      const nonTrumps = validDefenses.filter(c => c.suit !== trumpSuit);
      if (nonTrumps.length > 0) {
        nonTrumps.sort((a, b) => a.rank - b.rank);
        return nonTrumps[0];
      }
    }
    
    // Default: minimal defense
    validDefenses.sort((a, b) => this.getCardStrength(a, trumpSuit) - this.getCardStrength(b, trumpSuit));
    return validDefenses[0];
  }
}