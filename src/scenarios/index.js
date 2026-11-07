// Scenario registry. Add a scenario by importing it here (picker order = array order, easiest first).
import urlShortener from './url-shortener.js';
import marketplace from './marketplace.js';
import video from './video.js';
import chat from './chat.js';
import tickets from './tickets.js';

export const SCENARIOS = [urlShortener, marketplace, video, chat, tickets];
export const byId = (id) => SCENARIOS.find((s) => s.id === id);
