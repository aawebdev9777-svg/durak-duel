// MASTER AI STRATEGY ENGINE - MULTIPLE PLAY STYLES AND ADAPTIVE LEARNING
import { DurakProbabilityEngine } from './AIProbability';

export class AIStrategyEngine {
  constructor(difficulty = 'aha', learnedKnowledge = null) {
    this.difficulty = difficulty;
    this.knowledge = learnedKnowledge || [];
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

  // AHA AI - Uses learned knowledge + probability + advanced tactics
  ahaStrategy(hand, gameState, action) {
    const { trumpSuit, tableCards, deckSize, opponentHandSize, ourHandSize } = gameState;
    const prob = new DurakProbabilityEngine(trumpSuit, deckSize, this.getVisibleCards(hand, tableCards));
    
    // Query learned knowledge for similar situations
    const similarSituations = this.findSimilarKnowledge({
      handSize: ourHandSize,
      phase: action,
      deckSize,
      tableCards: tableCards.length
    });
    
    let decision;
    
    if (action === 'attack') {
      decision = prob.findOptimalAttack(hand, tableCards, opponentHandSize);
      
      // Apply learned patterns
      if (similarSituations.length > 0) {
        const learnedCard = this.applyLearnedPatterns(hand, similarSituations, 'attack');
        if (learnedCard && Math.random() < 0.3) {
          decision = learnedCard;
        }
      }
      
      // Advanced opening theory
      if (tableCards.length === 0) {
        decision = this.applyOpeningTheory(hand, trumpSuit, deckSize, opponentHandSize);
      }
      
      // Endgame tactics
      if (deckSize === 0 && ourHandSize <= 3) {
        decision = this.applyEndgameTheory(hand, opponentHandSize, trumpSuit);
      }
    }
    
    if (action === 'defend') {
      const undefended = tableCards.find(p => !p.defense);
      if (!undefended) return null;
      
      decision = prob.findOptimalDefense(undefended.attack, hand, opponentHandSize);
      
      // Apply learned defense patterns
      if (similarSituations.length > 0) {
        const learnedCard = this.applyLearnedPatterns(hand, similarSituations, 'defense');
        if (learnedCard && this.canBeat(undefended.attack, learnedCard, trumpSuit)) {
          if (Math.random() < 0.25) {
            decision = learnedCard;
          }
        }
      }
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
}