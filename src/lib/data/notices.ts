const PRIVACY_NOTICE_KEY = 'oni-quest-advisor:notice:privacy';
const ONLINE_INTRO_KEY = 'oni-quest-advisor:notice:online-intro';

export function isPrivacyNoticeAcknowledged(): boolean {
	try {
		return window.localStorage.getItem(PRIVACY_NOTICE_KEY) !== null;
	} catch {
		return true;
	}
}

export function acknowledgePrivacyNotice(): void {
	try {
		window.localStorage.setItem(PRIVACY_NOTICE_KEY, '1');
	} catch {
		// Storage unavailable — the notice simply reappears on the next visit.
	}
}

export function isOnlineIntroSeen(): boolean {
	try {
		return window.localStorage.getItem(ONLINE_INTRO_KEY) !== null;
	} catch {
		return true;
	}
}

export function markOnlineIntroSeen(): void {
	try {
		window.localStorage.setItem(ONLINE_INTRO_KEY, '1');
	} catch {
		// Storage unavailable — the intro simply reappears on the next visit.
	}
}
