export class HttpError extends Error {
  constructor(status, message, code = 'INVALID_REQUEST') { super(message); this.status = status; this.code = code; }
}
export function check(condition, message, status = 422, code) { if (!condition) throw new HttpError(status, message, code); }
