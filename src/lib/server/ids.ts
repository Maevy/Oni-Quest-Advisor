import { createHash, randomBytes } from 'node:crypto';

/** Unambiguous characters (no I, L, O, 0, 1) — game codes appear in invite links and titles. */
const GAME_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GAME_CODE_LENGTH = 6;

export function generateGameCode(): string {
	const bytes = randomBytes(GAME_CODE_LENGTH);
	let code = '';
	for (const byte of bytes) {
		code += GAME_CODE_ALPHABET[byte % GAME_CODE_ALPHABET.length];
	}
	return code;
}

/** Plain seat token — returned to the client exactly once, never stored. */
export function generateSeatToken(): string {
	return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}
