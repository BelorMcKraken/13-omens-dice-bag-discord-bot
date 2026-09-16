"use strict";
class RoomError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new RoomError(code, message); };
function object(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) fail("INVALID_PAYLOAD", "Invalid request fields.");
}
function text(value, label, max = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) fail("INVALID_PAYLOAD", `${label} must contain 1–${max} readable characters.`);
  return value.trim();
}
function number(value, max) {
  if ((typeof value !== "number" && typeof value !== "string") || value === "" || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > max) fail("INVALID_PAYLOAD", "Invalid numeric value.");
  return Number(value);
}


module.exports = { RoomError, fail, object, text, number };
