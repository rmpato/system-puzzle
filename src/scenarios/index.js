// Scenario registry. Add a scenario by importing it here (picker order = array order, easiest first).
import urlShortener from './url-shortener.js';
import marketplace from './marketplace.js';
import video from './video.js';
import typeahead from './typeahead.js';
import chat from './chat.js';
import tickets from './tickets.js';
import rides from './rides.js';
import ledger from './ledger.js';

export const SCENARIOS = [urlShortener, typeahead, marketplace, video, chat, tickets, rides, ledger];
export const byId = (id) => SCENARIOS.find((s) => s.id === id);
