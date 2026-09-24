// Small randomness helpers shared by every game generator. None of them
// mutate their input — a question bank or option list is only ever copied,
// so the original definitions stay exactly as authored.

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Fisher-Yates on a copy.
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// `count` distinct items, in random order, without touching `items`.
const sample = (items, count) => shuffle(items).slice(0, count);

module.exports = { randomInt, shuffle, sample };
