import { pickRandom, type Rng } from './random';
import type { MapSpec } from './map';

export type SetupItem = {
	label: string;
	description: string;
};

export type ResultObjectiveDef = {
	id: string;
	text: string;
	vp: number;
	/** How many independent times this objective can be scored (e.g. one per token on the table). */
	count: number;
};

export type QuestRuleSection = {
	/** Empty for a mission with a single flowing paragraph and no named subsections. */
	label: string;
	description: string;
};

export type Mission = {
	id: string;
	season: string;
	name: string;
	description: string;
	/** Informational only — not read by any app logic. */
	brokenMorale: boolean;
	/** When true, Results gains the automatic "Ceasefire broken" −4 VP objective. */
	ceasefire: boolean;
	setup: SetupItem[];
	map: MapSpec;
	results: ResultObjectiveDef[];
	/** Rules callouts shown alongside Results (e.g. Round-1 restrictions) — not counted for VP. */
	important?: string[];
	questRules: QuestRuleSection[];
};

export const CEASEFIRE_OBJECTIVE_ID = 'ceasefire-broken';

export const CEASEFIRE_OBJECTIVE: ResultObjectiveDef = {
	id: CEASEFIRE_OBJECTIVE_ID,
	text: 'Ceasefire broken',
	vp: -4,
	count: 1
};

export type RuleCallout = {
	title: string;
	/** Optional subheading rendered above the text (e.g. "1st Round Ceasefire"). */
	heading?: string;
	text: string;
};

export const CEASEFIRE_RULE: RuleCallout = {
	title: 'Ceasefire',
	heading: '1st Round Ceasefire',
	text: 'Players cannot score VP during the first round. If a model targets an enemy model with an Attack or damages an enemy model with an Action during Round 1, that player’s party receives a –4 VP penalty. Summoned models are an exception to this rule and may be targeted and damaged. However, Attacks or Wounds caused by Summoned models still incur the penalty. (A player’s VP score may drop below 0 as a result.)'
};

export const BROKEN_MORALE_RULE: RuleCallout = {
	title: 'Broken Morale',
	text: 'If a player’s party is in a state of Broken Morale at the start of their Strategic phase, the Quest ends at the end of that Turn.'
};

/** Every objective shown in Results — the mission's own, plus the ceasefire penalty when it applies. */
export function getScoreableResults(mission: Mission): ResultObjectiveDef[] {
	return mission.ceasefire ? [...mission.results, CEASEFIRE_OBJECTIVE] : mission.results;
}

export function pickRandomMission(missions: Mission[], rng: Rng): Mission {
	return pickRandom(missions, rng);
}
