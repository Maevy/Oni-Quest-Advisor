/** Thrown by API handlers and mutation callbacks; the `api` wrapper turns it into a JSON response. */
export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}
