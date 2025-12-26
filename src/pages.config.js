import Game from './pages/Game';
import Home from './pages/Home';
import KnowledgeBase from './pages/KnowledgeBase';
import Training from './pages/Training';
import AIBattle from './pages/AIBattle';
import Tactics from './pages/Tactics';


export const PAGES = {
    "Game": Game,
    "Home": Home,
    "KnowledgeBase": KnowledgeBase,
    "Training": Training,
    "AIBattle": AIBattle,
    "Tactics": Tactics,
}

export const pagesConfig = {
    mainPage: "Game",
    Pages: PAGES,
};