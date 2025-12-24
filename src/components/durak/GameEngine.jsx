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
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
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
export function evaluateCard(card, trumpSuit, hand) {
  let score = card.rank;
  
  // Trump cards are more valuable to keep
  if (card.suit === trumpSuit) {
    score += 20;
  }
  
  // Cards we have pairs of are good for attacking
  const sameRankCount = hand.filter(c => c.rank === card.rank).length;
  if (sameRankCount > 1) {
    score -= 5; // Slightly prefer playing these
  }
  
  return score;
}

export function aiSelectAttack(hand, tableCards, trumpSuit, difficulty) {
  const validCards = getValidAttackCards(hand, tableCards);
  if (validCards.length === 0) return null;
  
  // Sort by value (lower = better to play first)
  const sorted = [...validCards].sort((a, b) => {
    const scoreA = evaluateCard(a, trumpSuit, hand);
    const scoreB = evaluateCard(b, trumpSuit, hand);
    return scoreA - scoreB;
  });
  
  // Difficulty affects randomness
  if (difficulty === 'easy') {
    return sorted[Math.floor(Math.random() * sorted.length)];
  } else if (difficulty === 'medium') {
    const topHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
    return topHalf[Math.floor(Math.random() * topHalf.length)];
  } else {
    // Hard/Champion - play optimally with some strategy
    // Prefer cards of same rank for multi-attack
    const rankCounts = {};
    validCards.forEach(c => {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    });
    
    const multiAttack = validCards.filter(c => rankCounts[c.rank] > 1);
    if (multiAttack.length > 0 && Math.random() > 0.3) {
      return multiAttack.sort((a, b) => evaluateCard(a, trumpSuit, hand) - evaluateCard(b, trumpSuit, hand))[0];
    }
    
    return sorted[0];
  }
}

export function aiSelectDefense(hand, attackCard, trumpSuit, difficulty) {
  const validCards = getValidDefenseCards(hand, attackCard, trumpSuit);
  if (validCards.length === 0) return null;
  
  // Sort by value (lower = better to use for defense)
  const sorted = [...validCards].sort((a, b) => {
    const scoreA = evaluateCard(a, trumpSuit, hand);
    const scoreB = evaluateCard(b, trumpSuit, hand);
    return scoreA - scoreB;
  });
  
  if (difficulty === 'easy') {
    // Sometimes take cards even when could defend
    if (Math.random() < 0.2) return null;
    return sorted[Math.floor(Math.random() * sorted.length)];
  } else if (difficulty === 'medium') {
    if (Math.random() < 0.1) return null;
    return sorted[0];
  } else {
    // Hard/Champion - optimal defense
    // Consider if it's worth defending
    const lowestDefense = sorted[0];
    const attackValue = evaluateCard(attackCard, trumpSuit, []);
    const defenseValue = evaluateCard(lowestDefense, trumpSuit, hand);
    
    // Don't waste high trumps on low attacks early game
    if (defenseValue > attackValue + 15 && hand.length > 4) {
      return null;
    }
    
    return lowestDefense;
  }
}

export function aiShouldContinueAttack(hand, tableCards, defenderHandSize, trumpSuit, difficulty) {
  const validCards = getValidAttackCards(hand, tableCards);
  if (validCards.length === 0) return false;
  
  // Can't attack with more cards than defender has
  const undefendedCount = tableCards.filter(p => !p.defense).length;
  if (undefendedCount >= defenderHandSize) return false;
  
  if (difficulty === 'easy') {
    return Math.random() < 0.3;
  } else if (difficulty === 'medium') {
    return Math.random() < 0.5 && validCards.some(c => evaluateCard(c, trumpSuit, hand) < 15);
  } else {
    // Champion - strategic continuation
    const lowValueCards = validCards.filter(c => evaluateCard(c, trumpSuit, hand) < 12);
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