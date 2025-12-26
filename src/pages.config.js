import Game from './pages/Game';
import Home from './pages/Home';
import KnowledgeBase from './pages/KnowledgeBase';
import Training from './pages/Training';
import AIBattle from './pages/AIBattle';


export const PAGES = {
    "Game": Game,
    "Home": Home,
    "KnowledgeBase": KnowledgeBase,
    "Training": Training,
    "AIBattle": AIBattle,
}

export const pagesConfig = {
    mainPage: "Game",
    Pages: PAGES,
};