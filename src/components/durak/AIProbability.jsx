// ADVANCED PROBABILITY ENGINE FOR DURAK AI
// Calculates optimal plays using probability theory and game theory

export class DurakProbabilityEngine {
  constructor(trumpSuit, deckSize, visibleCards) {
    this.trumpSuit = trumpSuit;
    this.deckSize = deckSize;
    this.visibleCards = visibleCards || [];
    this.allCards = this.generateFullDeck();
    this.unknownCards = this.calculateUnknownCards();
  }

  generateFullDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = [6, 7, 8, 9, 10, 11, 12, 13, 14];
    const deck = [];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit, id: `${rank}-${suit}` });
      }
    }
    return deck;
  }

  calculateUnknownCards() {
    const visibleIds = new Set(this.visibleCards.map(c => c.id));
    return this.allCards.filter(c => !visibleIds.has(c.id));
  }

  // Calculate probability that opponent has a card that can beat this card
  probabilityOpponentCanBeat(card, opponentHandSize) {
    if (opponentHandSize === 0) return 0;
    
    const beatingCards = this.unknownCards.filter(c => this.canBeat(card, c));
    const totalUnknown = this.unknownCards.length;
    
    if (totalUnknown === 0) return 0;
    
    // Hypergeometric distribution
    const p = beatingCards.length / totalUnknown;
    const probHasNone = Math.pow(1 - p, opponentHandSize);
    return 1 - probHasNone;
  }

  // Calculate expected value of playing this card
  calculateExpectedValue(card, gameState) {
    const { opponentHandSize, ourHandSize, tableCards, phase } = gameState;
    
    let ev = 0;
    
    // Base value of card (lower is better to get rid of)
    const cardValue = this.getCardValue(card);
    ev += (15 - cardValue) * 0.1; // Reward playing low cards
    
    // Trump conservation bonus
    if (card.suit === this.trumpSuit) {
      ev -= 0.3; // Penalty for using trump
      if (this.deckSize < 5) ev += 0.2; // But OK in endgame
    }
    
    // Endgame strategy
    if (ourHandSize <= 3) {
      ev += 0.4; // Be aggressive
      if (cardValue >= 12) ev += 0.3; // Use high cards now
    }
    
    // Opening strategy
    if (tableCards.length === 0 && phase === 'attack') {
      if (cardValue <= 8) ev += 0.5; // Start with low cards
      if (cardValue >= 12) ev -= 0.4; // Save high cards
    }
    
    // Probability considerations
    if (phase === 'attack') {
      const beatProb = this.probabilityOpponentCanBeat(card, opponentHandSize);
      ev += (1 - beatProb) * 0.6; // Reward cards opponent likely can't beat
    }
    
    return ev;
  }

  canBeat(attackCard, defenseCard) {
    if (defenseCard.suit === this.trumpSuit && attackCard.suit !== this.trumpSuit) {
      return true;
    }
    if (defenseCard.suit === attackCard.suit && defenseCard.rank > attackCard.rank) {
      return true;
    }
    return false;
  }

  getCardValue(card) {
    const baseValue = card.rank;
    const trumpBonus = card.suit === this.trumpSuit ? 10 : 0;
    return baseValue + trumpBonus;
  }

  // Calculate optimal defense strategy
  findOptimalDefense(attackCard, hand, opponentHandSize) {
    const validDefenses = hand.filter(c => this.canBeat(attackCard, c));
    if (validDefenses.length === 0) return null;

    // Score each defense option
    const scored = validDefenses.map(card => {
      let score = 0;
      
      // Prefer using cards just above attacker
      const margin = this.getCardValue(card) - this.getCardValue(attackCard);
      score -= margin * 0.3; // Prefer minimal overkill
      
      // Avoid using trumps if possible
      if (card.suit === this.trumpSuit) {
        score -= 0.8;
        if (this.deckSize > 10) score -= 0.5; // Especially avoid early
      }
      
      // Save high cards for later
      if (card.rank >= 13) score -= 0.6;
      
      // If endgame, be more willing to use trumps
      if (this.deckSize < 5 && card.suit === this.trumpSuit) {
        score += 0.7;
      }
      
      // Consider opponent's likely strength
      const opponentBeatProb = this.probabilityOpponentCanBeat(card, opponentHandSize);
      score += opponentBeatProb * 0.4;
      
      return { card, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].card;
  }

  // Calculate optimal attack strategy
  findOptimalAttack(hand, tableCards, opponentHandSize) {
    const validAttacks = this.getValidAttackCards(hand, tableCards);
    if (validAttacks.length === 0) return null;

    const scored = validAttacks.map(card => {
      const ev = this.calculateExpectedValue(card, {
        opponentHandSize,
        ourHandSize: hand.length,
        tableCards,
        phase: 'attack'
      });
      
      let score = ev;
      
      // Additional attack-specific scoring
      const beatProb = this.probabilityOpponentCanBeat(card, opponentHandSize);
      score += (1 - beatProb) * 0.8;
      
      // If we have duplicates, use them
      const duplicates = hand.filter(c => c.rank === card.rank).length;
      if (duplicates > 1) score += 0.3;
      
      // Pressure strategy - use low cards to force opponent to use high cards
      if (card.rank <= 8 && opponentHandSize <= 3) {
        score += 0.5;
      }
      
      return { card, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].card;
  }

  getValidAttackCards(hand, tableCards) {
    if (tableCards.length === 0) return hand;
    
    const tableRanks = new Set();
    tableCards.forEach(pair => {
      tableRanks.add(pair.attack.rank);
      if (pair.defense) tableRanks.add(pair.defense.rank);
    });
    
    return hand.filter(c => tableRanks.has(c.rank));
  }

  // Advanced: Should we continue attacking?
  shouldContinueAttack(hand, tableCards, opponentHandSize, defenderCards) {
    // Never attack with more cards than defender has
    if (tableCards.length >= defenderCards) return false;
    
    // Don't continue if no valid attacks
    const validAttacks = this.getValidAttackCards(hand, tableCards);
    if (validAttacks.length === 0) return false;
    
    // Endgame aggression
    if (hand.length <= 2 && opponentHandSize <= 2) return true;
    
    // Calculate risk/reward
    const allDefended = tableCards.every(p => p.defense);
    if (!allDefended) return false; // Wait for defense first
    
    // Don't overextend early game
    if (this.deckSize > 15 && tableCards.length >= 3) {
      return Math.random() > 0.7;
    }
    
    // Mid-game balanced
    if (this.deckSize > 5 && tableCards.length >= 4) {
      return Math.random() > 0.6;
    }
    
    // Endgame pressure
    if (this.deckSize <= 5) {
      return tableCards.length < Math.min(5, defenderCards);
    }
    
    return Math.random() > 0.5;
  }

  // Advanced card counting
  estimateOpponentStrength(opponentHandSize, cardsPlayed) {
    const highCardsRemaining = this.unknownCards.filter(c => 
      c.rank >= 12 || c.suit === this.trumpSuit
    ).length;
    
    const totalUnknown = this.unknownCards.length;
    if (totalUnknown === 0) return 0.5;
    
    const strengthRatio = highCardsRemaining / totalUnknown;
    const handStrength = strengthRatio * opponentHandSize;
    
    return handStrength / 6; // Normalize to 0-1
  }

  // MCTS-inspired: Estimate probability opponent can defend this card
  estimateDefenseProbability(attackCard, opponentHandSize) {
    if (opponentHandSize === 0) return 0;
    
    const unknownCards = this.unknownCards;
    const totalUnknown = unknownCards.length;
    if (totalUnknown === 0) return 0.5;
    
    // Count cards that can beat this attack
    let canBeatCount = 0;
    unknownCards.forEach(card => {
      if (this.canBeat(attackCard, card)) {
        canBeatCount++;
      }
    });
    
    // Probability at least one defense card in opponent's hand
    const probPerCard = canBeatCount / totalUnknown;
    const probNoDefense = Math.pow(1 - probPerCard, opponentHandSize);
    return 1 - probNoDefense;
  }

  getUnknownCards() {
    return this.unknownCards;
  }
}