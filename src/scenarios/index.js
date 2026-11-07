// Scenario registry. Add a scenario by importing it here.
import marketplace from './marketplace.js';

export const SCENARIOS = [marketplace];
export const byId = (id) => SCENARIOS.find((s) => s.id === id);
