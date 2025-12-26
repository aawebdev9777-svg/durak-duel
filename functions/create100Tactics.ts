import { base44 } from '@/api/base44Client';

export default async function create100Tactics() {
  const tacticTemplates = [
    // Opening strategies
    { name: 'Aggressive Opening Alpha', phase: 'attack', handSize: 6, deckRem: 30, type: 'aggressive_start', pref: 'low_cards', aggr: 0.8, success: 0.6 },
    { name: 'Conservative Opening Beta', phase: 'attack', handSize: 6, deckRem: 30, type: 'conservative', pref: 'medium_cards', aggr: 0.4, success: 0.55 },
    { name: 'Trump Saver Gamma', phase: 'attack', handSize: 6, deckRem: 30, type: 'conservative', pref: 'singles', aggr: 0.3, success: 0.58 },
    { name: 'Duplicate Attack Delta', phase: 'attack', handSize: 6, deckRem: 28, type: 'multi_attack', pref: 'duplicates', aggr: 0.7, success: 0.62 },
    { name: 'Low Value Lead Epsilon', phase: 'attack', handSize: 6, deckRem: 30, type: 'aggressive_start', pref: 'low_cards', aggr: 0.6, success: 0.59 },
    
    // Early defense
    { name: 'Minimal Defense Alpha', phase: 'defend', handSize: 6, deckRem: 28, type: 'conservative', pref: 'low_cards', aggr: 0.3, success: 0.57 },
    { name: 'Trump Hold Beta', phase: 'defend', handSize: 6, deckRem: 28, type: 'conservative', pref: 'singles', aggr: 0.2, success: 0.6 },
    { name: 'Aggressive Counter Gamma', phase: 'defend', handSize: 5, deckRem: 26, type: 'aggressive_start', pref: 'medium_cards', aggr: 0.6, success: 0.54 },
    
    // Midgame attack
    { name: 'Midgame Pressure Alpha', phase: 'attack', handSize: 4, deckRem: 18, type: 'multi_attack', pref: 'duplicates', aggr: 0.85, success: 0.63 },
    { name: 'Midgame Trump Push Beta', phase: 'attack', handSize: 4, deckRem: 15, type: 'aggressive_start', pref: 'high_trumps', aggr: 0.75, success: 0.61 },
    { name: 'Card Advantage Gamma', phase: 'attack', handSize: 5, deckRem: 20, type: 'multi_attack', pref: 'duplicates', aggr: 0.8, success: 0.64 },
    { name: 'Controlled Aggression Delta', phase: 'attack', handSize: 4, deckRem: 16, type: 'aggressive_start', pref: 'medium_cards', aggr: 0.65, success: 0.58 },
    { name: 'Rank Matching Epsilon', phase: 'attack', handSize: 4, deckRem: 18, type: 'multi_attack', pref: 'duplicates', aggr: 0.9, success: 0.66 },
    
    // Midgame defense
    { name: 'Midgame Hold Zeta', phase: 'defend', handSize: 4, deckRem: 18, type: 'conservative', pref: 'low_cards', aggr: 0.3, success: 0.56 },
    { name: 'Strategic Take Eta', phase: 'defend', handSize: 3, deckRem: 15, type: 'desperate_defense', pref: 'any_valid', aggr: 0.2, success: 0.52 },
    { name: 'Trump Counter Theta', phase: 'defend', handSize: 4, deckRem: 16, type: 'conservative', pref: 'high_trumps', aggr: 0.4, success: 0.6 },
    
    // Late game attack
    { name: 'Endgame Pressure Iota', phase: 'attack', handSize: 3, deckRem: 8, type: 'aggressive_start', pref: 'medium_cards', aggr: 0.85, success: 0.62 },
    { name: 'Trump Finish Kappa', phase: 'attack', handSize: 2, deckRem: 4, type: 'trump_finish', pref: 'high_trumps', aggr: 0.95, success: 0.7 },
    { name: 'Deck End Push Lambda', phase: 'attack', handSize: 3, deckRem: 6, type: 'aggressive_start', pref: 'duplicates', aggr: 0.9, success: 0.65 },
    
    // Late game defense
    { name: 'Desperate Hold Mu', phase: 'defend', handSize: 3, deckRem: 8, type: 'desperate_defense', pref: 'any_valid', aggr: 0.4, success: 0.5 },
    { name: 'Last Stand Nu', phase: 'defend', handSize: 2, deckRem: 4, type: 'desperate_defense', pref: 'high_trumps', aggr: 0.3, success: 0.48 },
    
    // Endgame dominance
    { name: 'Victory Push Xi', phase: 'attack', handSize: 2, deckRem: 0, type: 'trump_finish', pref: 'high_trumps', aggr: 1.0, success: 0.75 },
    { name: 'Final Strike Omicron', phase: 'attack', handSize: 1, deckRem: 0, type: 'trump_finish', pref: 'any_valid', aggr: 1.0, success: 0.72 },
    { name: 'Endgame Control Pi', phase: 'attack', handSize: 3, deckRem: 0, type: 'aggressive_start', pref: 'high_trumps', aggr: 0.95, success: 0.68 },
    
    // Special scenarios
    { name: 'Trump Conservation Rho', phase: 'attack', handSize: 5, deckRem: 25, type: 'conservative', pref: 'singles', aggr: 0.35, success: 0.57 },
    { name: 'High Card Disposal Sigma', phase: 'attack', handSize: 6, deckRem: 20, type: 'aggressive_start', pref: 'medium_cards', aggr: 0.7, success: 0.59 },
    { name: 'Deck Advantage Tau', phase: 'attack', handSize: 6, deckRem: 10, type: 'multi_attack', pref: 'duplicates', aggr: 0.8, success: 0.63 },
  ];
  
  const tactics = [];
  
  // Generate 100 tactics with variations
  for (let i = 0; i < 100; i++) {
    const template = tacticTemplates[i % tacticTemplates.length];
    const variation = Math.floor(i / tacticTemplates.length);
    
    tactics.push({
      tactic_name: `${template.name} V${variation + 1}`,
      scenario: {
        hand_size: template.handSize + Math.floor(Math.random() * 2) - 1,
        opponent_hand_size: Math.floor(Math.random() * 6) + 1,
        deck_remaining: template.deckRem + Math.floor(Math.random() * 8) - 4,
        phase: template.phase
      },
      action: {
        type: template.type,
        card_preference: template.pref,
        aggression_level: Math.max(0.1, Math.min(1.0, template.aggr + (Math.random() * 0.2 - 0.1)))
      },
      success_rate: Math.max(0.4, Math.min(0.8, template.success + (Math.random() * 0.1 - 0.05))),
      times_used: 0,
      times_won: 0,
      learned_from_game: 'initial_knowledge',
      confidence: 0.5
    });
  }
  
  // Insert in batches
  const batchSize = 20;
  for (let i = 0; i < tactics.length; i += batchSize) {
    const batch = tactics.slice(i, i + batchSize);
    await base44.entities.AHATactic.bulkCreate(batch);
  }
  
  return { success: true, created: tactics.length };
}