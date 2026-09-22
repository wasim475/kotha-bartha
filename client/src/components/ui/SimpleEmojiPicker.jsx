import EmojiPicker, { Categories } from "emoji-picker-react";

// Every real emoji category, deliberately excluding Categories.SUGGESTED
// (emoji-picker-react's "Recently Used" section) and Categories.CUSTOM
// (unused — this app has no custom emoji set). Passing this fixed list is
// how the package's docs say to drop a category entirely, rather than just
// hiding it with CSS.
const CATEGORIES_WITHOUT_SUGGESTED = [
  { category: Categories.SMILEYS_PEOPLE },
  { category: Categories.ANIMALS_NATURE },
  { category: Categories.FOOD_DRINK },
  { category: Categories.TRAVEL_PLACES },
  { category: Categories.ACTIVITIES },
  { category: Categories.OBJECTS },
  { category: Categories.SYMBOLS },
  { category: Categories.FLAGS },
];

/**
 * emoji-picker-react (the package already used for message/comment/post
 * emoji), pinned to a plain category grid — no search box, no "Recently
 * Used"/suggested section. Used anywhere the app wants a picker without
 * either of those (conversation Like-emoji picker, post composer, comment
 * composer).
 */
export default function SimpleEmojiPicker({ onEmojiClick, width = 300, height = 360 }) {
  return (
    <EmojiPicker
      onEmojiClick={onEmojiClick}
      width={width}
      height={height}
      searchDisabled
      previewConfig={{ showPreview: false }}
      categories={CATEGORIES_WITHOUT_SUGGESTED}
      lazyLoadEmojis
    />
  );
}
