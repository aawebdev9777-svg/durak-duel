import AIBattle from './pages/AIBattle';
import Game from './pages/Game';
import Home from './pages/Home';
import KnowledgeBase from './pages/KnowledgeBase';
import Tactics from './pages/Tactics';
import Training from './pages/Training';


export const PAGES = {
    "AIBattle": AIBattle,
    "Game": Game,
    "Home": Home,
    "KnowledgeBase": KnowledgeBase,
    "Tactics": Tactics,
    "Training": Training,
}

export const pagesConfig = {
    mainPage: "Game",
    Pages: PAGES,
};