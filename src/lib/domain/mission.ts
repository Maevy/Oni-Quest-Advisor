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
	/** Informational only — not read by any app logic. */
	ceasefire: boolean;
	setup: SetupItem[];
	map: MapSpec;
	results: ResultObjectiveDef[];
	/** Rules callouts shown alongside Results (e.g. Round-1 restrictions) — not counted for VP. */
	important?: string[];
	questRules: QuestRuleSection[];
};

export function pickRandomMission(missions: Mission[], rng: Rng): Mission {
	return pickRandom(missions, rng);
}
