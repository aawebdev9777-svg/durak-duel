// Durak Game Engine

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = [6, 7, 8, 9, 10, 11, 12, 13, 14]; // 6-10, J, Q, K, A

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return shuffleDeck(deck);
}

export function shuffleDeck(deck) {
  const shuffled = [...deck];
  
  // Multiple shuffle passes for better randomization
  for (let pass = 0; pass < 3; pass++) {
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Use crypto.getRandomValues for better randomness
      const randomBuffer = new Uint32Array(1);
      crypto.getRandomValues(randomBuffer);
      const j = Math.floor((randomBuffer[0] / (0xFFFFFFFF + 1)) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }
  
  return shuffled;
}

export function dealCards(deck, numPlayers, cardsPerPlayer = 6) {
  const hands = Array.from({ length: numPlayers }, () => []);
  let deckCopy = [...deck];
  
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let p = 0; p < numPlayers; p++) {
      if (deckCopy.length > 0) {
        hands[p].push(deckCopy.pop());
      }
    }
  }
  
  return { hands, remainingDeck: deckCopy };
}

export function canBeat(attackCard, defenseCard, trumpSuit) {
  // Trump beats non-trump
  if (defenseCard.suit === trumpSuit && attackCard.suit !== trumpSuit) {
    return true;
  }
  // Non-trump can't beat trump
  if (attackCard.suit === trumpSuit && defenseCard.suit !== trumpSuit) {
    return false;
  }
  // Same suit, higher rank wins
  if (attackCard.suit === defenseCard.suit) {
    return defenseCard.rank > attackCard.rank;
  }
  // Different suits (neither trump) - can't beat
  return false;
}

export function canAddToAttack(card, tableCards) {
  if (tableCards.length === 0) return true;
  
  const ranksOnTable = new Set();
  tableCards.forEach(pair => {
    ranksOnTable.add(pair.attack.rank);
    if (pair.defense) {
      ranksOnTable.add(pair.defense.rank);
    }
  });
  
  return ranksOnTable.has(card.rank);
}

export function getValidDefenseCards(hand, attackCard, trumpSuit) {
  return hand.filter(card => canBeat(attackCard, card, trumpSuit));
}

export function getValidAttackCards(hand, tableCards) {
  if (tableCards.length === 0) return hand;
  return hand.filter(card => canAddToAttack(card, tableCards));
}

export function refillHands(hands, deck, startingPlayer) {
  let deckCopy = [...deck];
  const newHands = [...hands];
  
  // Refill in order starting from attacker
  const order = [];
  for (let i = 0; i < hands.length; i++) {
    order.push((startingPlayer + i) % hands.length);
  }
  
  for (const playerIdx of order) {
    while (newHands[playerIdx].length < 6 && deckCopy.length > 0) {
      newHands[playerIdx].push(deckCopy.pop());
    }
  }
  
  return { hands: newHands, remainingDeck: deckCopy };
}

// AI Logic
export function evaluateCard(card, trumpSuit, hand, strategyWeights = null) {
  let score = card.rank;
  
  const weights = strategyWeights || {
    aggressive_factor: 1.0,
    trump_conservation: 1.0,
    card_value_threshold: 15
  };
  
  // Trump cards are more valuable to keep
  if (card.suit === trumpSuit) {
    score += 20 * weights.trump_conservation;
  }
  
  // Cards we have pairs of are good for attacking
  const sameRankCount = hand.filter(c => c.rank === card.rank).length;
  if (sameRankCount > 1) {
    score -= 5 * weights.aggressive_factor;
  }
  
  return score;
}

export function aiSelectAttack(hand, tableCards, trumpSuit, difficulty, strategyWeights = null, learnedData = null, deckSize = 36, opponentHandSize = 6, tactics = null) {
  const validCards = getValidAttackCards(hand, tableCards);
  if (validCards.length === 0) return null;
  
  // ULTRA-POWERFUL TACTICAL AI - PRIORITIZE BEST TACTICS
  if (difficulty === 'aha' && tactics && tactics.length > 0) {
    const applicableTactics = tactics.filter(t => 
      t.scenario?.phase === 'attack' &&
      Math.abs((t.scenario.hand_size || 0) - hand.length) <= 3 &&
      Math.abs((t.scenario.deck_remaining || 0) - deckSize) <= 15 &&
      t.success_rate > 0.45 &&
      t.times_used >= 1
    ).sort((a, b) => {
      const scoreA = (a.success_rate * 2) + (a.confidence * 1.5) + (a.times_won / Math.max(a.times_used, 1));
      const scoreB = (b.success_rate * 2) + (b.confidence * 1.5) + (b.times_won / Math.max(b.times_used, 1));
      return scoreB - scoreA;
    });
    
    if (applicableTactics.length > 0) {
      const bestTactic = applicableTactics[0];
      
      // APPLY BEST TACTIC STRATEGY WITH MAXIMUM EFFECTIVENESS
      if (bestTactic.action?.card_preference === 'low_cards') {
        const lowCards = validCards.filter(c => c.rank <= 9);
        if (lowCards.length > 0) {
          lowCards.sort((a, b) => a.rank - b.rank);
          return lowCards[0];
        }
      } else if (bestTactic.action?.card_preference === 'medium_cards') {
        const medCards = validCards.filter(c => c.rank >= 9 && c.rank <= 12);
        if (medCards.length > 0) {
          medCards.sort((a, b) => evaluateCard(a, trumpSuit, hand, strategyWeights) - evaluateCard(b, trumpSuit, hand, strategyWeights));
          return medCards[0];
        }
      } else if (bestTactic.action?.card_preference === 'high_trumps') {
        const trumps = validCards.filter(c => c.suit === trumpSuit && c.rank >= 10);
        if (trumps.length > 0) {
          trumps.sort((a, b) => b.rank - a.rank);
          return trumps[0];
        }
      } else if (bestTactic.action?.card_preference === 'duplicates') {
        const ranks = {};
        hand.forEach(c => {
          ranks[c.rank] = (ranks[c.rank] || 0) + 1;
        });
        const duplicateRanks = Object.keys(ranks).filter(r => ranks[r] > 1);
        const dupCards = validCards.filter(c => duplicateRanks.includes(c.rank.toString()));
        if (dupCards.length > 0) {
          dupCards.sort((a, b) => a.rank - b.rank);
          return dupCards[0];
        }
      } else if (bestTactic.action?.card_preference === 'singles') {
        const ranks = {};
        hand.forEach(c => {
          ranks[c.rank] = (ranks[c.rank] || 0) + 1;
        });
        const singleCards = validCards.filter(c => ranks[c.rank] === 1);
        if (singleCards.length > 0) {
          singleCards.sort((a, b) => a.rank - b.rank);
          return singleCards[0];
        }
      }
      
      // MASTER-LEVEL AGGRESSION CONTROL
      if (bestTactic.action?.aggression_level > 0.65) {
        const highCards = validCards.filter(c => c.rank >= 11 || c.suit === trumpSuit);
        if (highCards.length > 0) {
          highCards.sort((a, b) => b.rank - a.rank);
          return highCards[0];
        }
      } else if (bestTactic.action?.aggression_level < 0.45) {
        validCards.sort((a, b) => a.rank - b.rank);
        return validCards[0];
      }
      
      // Execute tactic decision
      validCards.sort((a, b) => evaluateCard(a, trumpSuit, hand, strategyWeights) - evaluateCard(b, trumpSuit, hand, strategyWeights));
      return validCards[0];
    }
  }
  
  // Use advanced AI with tactics
  if (typeof window !== 'undefined' && window.AIStrategyEngine) {
    const ai = new window.AIStrategyEngine(difficulty, learnedData, tactics);
    const decision = ai.makeDecision(hand, {
      trumpSuit, tableCards, deckSize, opponentHandSize, ourHandSize: hand.length
    }, 'attack');
    if (decision) return decision;
  }
  
  // Sort by value (lower = better to play first)
  const sorted = [...validCards].sort((a, b) => {
    const scoreA = evaluateCard(a, trumpSuit, hand, strategyWeights);
    const scoreB = evaluateCard(b, trumpSuit, hand, strategyWeights);
    return scoreA - scoreB;
  });
  
  // Difficulty affects randomness
  if (difficulty === 'easy') {
    return sorted[Math.floor(Math.random() * sorted.length)];
  } else if (difficulty === 'medium') {
    const topHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
    return topHalf[Math.floor(Math.random() * topHalf.length)];
  } else if (difficulty === 'aha') {
    // AHA mode - uses REAL learned strategies from past games
    const rankCounts = {};
    validCards.forEach(c => {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    });
    
    const weights = strategyWeights || { aggressive_factor: 1.5, trump_conservation: 1.3, card_value_threshold: 12 };
    
    // Use learned data to make better decisions
    if (learnedData && learnedData.length > 0) {
      const learnedRanks = learnedData
        .filter(d => d.card_played && d.reward > 0.4)
        .map(d => d.card_played.rank);
      
      // Prefer cards that had high rewards in past
      const learnedCard = validCards.find(c => learnedRanks.includes(c.rank));
      if (learnedCard && Math.random() > 0.3) {
        return learnedCard;
      }
    }
    
    // Advanced multi-attack strategy
    const multiAttack = validCards.filter(c => rankCounts[c.rank] > 1);
    if (multiAttack.length > 0 && Math.random() > (0.2 / weights.aggressive_factor)) {
      return multiAttack.sort((a, b) => evaluateCard(a, trumpSuit, hand, weights) - evaluateCard(b, trumpSuit, hand, weights))[0];
    }
    
    // Consider hand size and game state
    if (hand.length > 8) {
      return sorted[0]; // Play conservatively with many cards
    }
    
    return sorted[Math.floor(Math.random() * Math.min(2, sorted.length))];
  } else {
    // Hard/Champion - play optimally with some strategy
    const rankCounts = {};
    validCards.forEach(c => {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    });
    
    const multiAttack = validCards.filter(c => rankCounts[c.rank] > 1);
    if (multiAttack.length > 0 && Math.random() > 0.3) {
      return multiAttack.sort((a, b) => evaluateCard(a, trumpSuit, hand, strategyWeights) - evaluateCard(b, trumpSuit, hand, strategyWeights))[0];
    }
    
    return sorted[0];
  }
}

export function aiSelectDefense(hand, attackCard, trumpSuit, difficulty, strategyWeights = null, learnedData = null, deckSize = 36, opponentHandSize = 6, tactics = null) {
  const validCards = getValidDefenseCards(hand, attackCard, trumpSuit);
  
  // ULTRA-SMART TACTICAL DEFENSE
  if (difficulty === 'aha' && tactics && tactics.length > 0) {
    const applicableTactics = tactics.filter(t => 
      t.scenario?.phase === 'defend' &&
      Math.abs((t.scenario.hand_size || 0) - hand.length) <= 3 &&
      Math.abs((t.scenario.deck_remaining || 0) - deckSize) <= 15 &&
      t.success_rate > 0.45 &&
      t.times_used >= 1
    ).sort((a, b) => {
      const scoreA = (a.success_rate * 2) + (a.confidence * 1.5) + (a.times_won / Math.max(a.times_used, 1));
      const scoreB = (b.success_rate * 2) + (b.confidence * 1.5) + (b.times_won / Math.max(b.times_used, 1));
      return scoreB - scoreA;
    });
    
    if (applicableTactics.length > 0 && validCards.length > 0) {
      const bestTactic = applicableTactics[0];
      
      // MASTER-LEVEL TACTICAL DEFENSE DECISIONS
      if (bestTactic.action?.type === 'desperate_defense' || bestTactic.action?.type === 'multi_attack') {
        validCards.sort((a, b) => evaluateCard(a, trumpSuit, hand, strategyWeights) - evaluateCard(b, trumpSuit, hand, strategyWeights));
        return validCards[0];
      } else if (bestTactic.action?.type === 'conservative') {
        const lowDefenses = validCards.filter(c => c.rank <= 11 && c.suit !== trumpSuit);
        if (lowDefenses.length > 0) {
          lowDefenses.sort((a, b) => a.rank - b.rank);
          return lowDefenses[0];
        }
        // Only take if all defenses are too valuable
        const avgDefenseValue = validCards.reduce((sum, c) => sum + evaluateCard(c, trumpSuit, hand, strategyWeights), 0) / validCards.length;
        const attackValue = evaluateCard(attackCard, trumpSuit, [], strategyWeights);
        if (avgDefenseValue > attackValue + 18) return null;
        return validCards[0];
      } else if (bestTactic.action?.type === 'trump_finish' && deckSize <= 5) {
        const trumpDefenses = validCards.filter(c => c.suit === trumpSuit);
        if (trumpDefenses.length > 0) {
          trumpDefenses.sort((a, b) => a.rank - b.rank);
          return trumpDefenses[0];
        }
      } else if (bestTactic.action?.type === 'aggressive_start' && hand.length >= 5) {
        const nonTrumpDefenses = validCards.filter(c => c.suit !== trumpSuit);
        if (nonTrumpDefenses.length > 0) {
          nonTrumpDefenses.sort((a, b) => a.rank - b.rank);
          return nonTrumpDefenses[0];
        }
      }
      
      // Use best available defense
      validCards.sort((a, b) => evaluateCard(a, trumpSuit, hand, strategyWeights) - evaluateCard(b, trumpSuit, hand, strategyWeights));
      return validCards[0];
    }
  }
  
  if (validCards.length === 0) return null;
  
  // Use advanced AI with tactics
  if (typeof window !== 'undefined' && window.AIStrategyEngine) {
    const ai = new window.AIStrategyEngine(difficulty, learnedData, tactics);
    const decision = ai.makeDecision(hand, {
      trumpSuit, tableCards: [{ attack: attackCard, defense: null }], deckSize, opponentHandSize, ourHandSize: hand.length
    }, 'defend');
    if (decision) return decision;
  }
  
  // Sort by value (lower = better to use for defense)
  const sorted = [...validCards].sort((a, b) => {
    const scoreA = evaluateCard(a, trumpSuit, hand, strategyWeights);
    const scoreB = evaluateCard(b, trumpSuit, hand, strategyWeights);
    return scoreA - scoreB;
  });
  
  if (difficulty === 'easy') {
    // Sometimes take cards even when could defend
    if (Math.random() < 0.2) return null;
    return sorted[Math.floor(Math.random() * sorted.length)];
  } else if (difficulty === 'medium') {
    if (Math.random() < 0.1) return null;
    return sorted[0];
  } else if (difficulty === 'aha') {
    // AHA mode - REAL learned defense from reinforcement learning
    const lowestDefense = sorted[0];
    const attackValue = evaluateCard(attackCard, trumpSuit, [], strategyWeights);
    const defenseValue = evaluateCard(lowestDefense, trumpSuit, hand, strategyWeights);
    
    const weights = strategyWeights || { card_value_threshold: 12 };
    
    // Use learned data - check what worked before
    if (learnedData && learnedData.length > 0) {
      const successfulDefenses = learnedData.filter(d => d.reward > 0.5 && d.card_played);
      const avgHandSize = successfulDefenses.length > 0 
        ? successfulDefenses.reduce((sum, d) => sum + d.hand_size, 0) / successfulDefenses.length 
        : 4;
      
      // Learn when to take vs defend based on past success
      if (hand.length < avgHandSize - 1 && defenseValue > attackValue + 10) {
        if (Math.random() < 0.2) return null; // Learned to sometimes take when cards are valuable
      }
    }
    
    // Strategic decision on whether to defend
    if (defenseValue > attackValue + weights.card_value_threshold && hand.length > 3) {
      if (Math.random() < 0.15) return null;
    }
    
    // Minimal defense - don't overspend
    return sorted[0];
  } else {
    // Hard/Champion - optimal defense
    const lowestDefense = sorted[0];
    const attackValue = evaluateCard(attackCard, trumpSuit, [], strategyWeights);
    const defenseValue = evaluateCard(lowestDefense, trumpSuit, hand, strategyWeights);
    
    // Don't waste high trumps on low attacks early game
    if (defenseValue > attackValue + 15 && hand.length > 4) {
      return null;
    }
    
    return lowestDefense;
  }
}

export function aiShouldContinueAttack(hand, tableCards, defenderHandSize, trumpSuit, difficulty, strategyWeights = null, learnedData = null) {
  const validCards = getValidAttackCards(hand, tableCards);
  if (validCards.length === 0) return false;
  
  // Can't attack with more cards than defender has
  const undefendedCount = tableCards.filter(p => !p.defense).length;
  if (undefendedCount >= defenderHandSize) return false;
  
  if (difficulty === 'easy') {
    return Math.random() < 0.3;
  } else if (difficulty === 'medium') {
    return Math.random() < 0.5 && validCards.some(c => evaluateCard(c, trumpSuit, hand, strategyWeights) < 15);
  } else if (difficulty === 'aha') {
    const weights = strategyWeights || { aggressive_factor: 1.5, card_value_threshold: 12 };
    
    // Learn from past successful multi-attacks
    if (learnedData && learnedData.length > 0) {
      const multiAttacks = learnedData.filter(d => d.move_number > 1 && d.reward > 0.3);
      if (multiAttacks.length > 5) {
        // Learned that continuing attacks can be good
        const lowValueCards = validCards.filter(c => evaluateCard(c, trumpSuit, hand, weights) < weights.card_value_threshold);
        return lowValueCards.length > 0 && Math.random() < (0.85 * weights.aggressive_factor);
      }
    }
    
    const lowValueCards = validCards.filter(c => evaluateCard(c, trumpSuit, hand, weights) < weights.card_value_threshold);
    return lowValueCards.length > 0 && Math.random() < (0.75 * weights.aggressive_factor);
  } else {
    // Champion - strategic continuation
    const lowValueCards = validCards.filter(c => evaluateCard(c, trumpSuit, hand, strategyWeights) < 12);
    return lowValueCards.length > 0 && Math.random() < 0.7;
  }
}

export function determineFirstAttacker(hands, trumpSuit) {
  let lowestTrump = null;
  let attackerIdx = 0;
  
  hands.forEach((hand, idx) => {
    hand.forEach(card => {
      if (card.suit === trumpSuit) {
        if (!lowestTrump || card.rank < lowestTrump.rank) {
          lowestTrump = card;
          attackerIdx = idx;
        }
      }
    });
  });
  
  return attackerIdx;
}

export function checkGameOver(hands, deckEmpty) {
  if (!deckEmpty) return { over: false };
  
  const playersWithCards = hands.map((h, i) => ({ idx: i, count: h.length }))
    .filter(p => p.count > 0);
  
  if (playersWithCards.length <= 1) {
    return {
      over: true,
      durak: playersWithCards.length === 1 ? playersWithCards[0].idx : null
    };
  }
  
  return { over: false };
}