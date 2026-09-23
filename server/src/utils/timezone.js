// Single source of truth for the timezone the Leaderboard's monthly cycle
// (8:00 AM start / 4:00 PM finalization) runs in — set once here via env,
// never hardcoded elsewhere. Defaults to the app's home timezone.
const LEADERBOARD_TIMEZONE = process.env.LEADERBOARD_TIMEZONE || "Asia/Dhaka";

// Reads an absolute instant's wall-clock date/time as it appears in the
// given timezone. Built on Intl.DateTimeFormat (built into Node) rather
// than a new dependency.
function zonedParts(date, timeZone = LEADERBOARD_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Intl can report midnight as "24" with hour12:false in some engines.
    hour: map.hour === "24" ? 0 : Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

// The inverse: given a wall-clock date/time meant to be read IN `timeZone`,
// returns the absolute UTC instant it corresponds to. There's no native
// Date constructor that accepts a timezone, so this uses the standard
// "guess, then correct by the zone's actual offset at that instant" trick.
function zonedTimeToUtc(year, month, day, hour, minute, timeZone = LEADERBOARD_TIMEZONE) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const guessInZone = zonedParts(utcGuess, timeZone);
  const guessAsIfUtc = new Date(
    Date.UTC(guessInZone.year, guessInZone.month - 1, guessInZone.day, guessInZone.hour, guessInZone.minute, guessInZone.second),
  );
  const offsetMs = guessAsIfUtc.getTime() - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

module.exports = { LEADERBOARD_TIMEZONE, zonedParts, zonedTimeToUtc };
