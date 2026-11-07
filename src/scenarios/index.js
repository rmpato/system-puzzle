// Scenario registry. Add a scenario by importing it here (picker order = array order).
import marketplace from './marketplace.js';
import video from './video.js';
import tickets from './tickets.js';
import chat from './chat.js';

export const SCENARIOS = [marketplace, video, tickets, chat];
export const byId = (id) => SCENARIOS.find((s) => s.id === id);
