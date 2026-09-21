const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

// Splits text into alternating plain-text/emoji runs by Unicode grapheme
// cluster, so multi-codepoint emoji (skin tones, ZWJ sequences) stay intact
// as one run instead of being split mid-glyph.
function splitEmojiRuns(text) {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    return [{ text, isEmoji: false }];
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const runs = [];

  for (const { segment } of segmenter.segment(text)) {
    const isEmoji = EXTENDED_PICTOGRAPHIC.test(segment);
    const last = runs[runs.length - 1];
    if (last && last.isEmoji === isEmoji) last.text += segment;
    else runs.push({ text: segment, isEmoji });
  }

  return runs;
}

/**
 * Renders post/comment/reply body text with emoji bumped to a larger inline
 * size. Chromium on Windows clips the top of color-emoji glyphs below about
 * 18px (confirmed clipped at 13-17px, clean at 18px+); since this app's body
 * text all renders well under that, emoji runs are scaled up relative to
 * the surrounding text so they clear the threshold regardless of context.
 */
export default function RichText({ text }) {
  return splitEmojiRuns(text ?? "").map((run, index) =>
    run.isEmoji ? (
      <span key={index} className="inline-block align-[-0.2em] text-[1.4em] leading-none">
        {run.text}
      </span>
    ) : (
      <span key={index}>{run.text}</span>
    ),
  );
}
