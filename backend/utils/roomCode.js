import crypto from "crypto";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

export function generateRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[crypto.randomInt(CHARS.length)];
  }
  return code;
}

export function generateReferralCode(length = 7) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[crypto.randomInt(CHARS.length)];
  }
  return code;
}
