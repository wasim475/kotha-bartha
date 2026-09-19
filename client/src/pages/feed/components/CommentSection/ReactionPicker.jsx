import { reactionTypes } from "../../data/reactionConfig";
import CommentReaction from "./CommentReaction";

const ReactionPicker = ({ onSelect }) => (
  <div className="reaction-popover">
    {reactionTypes.map((type) => (
      <button type="button" key={type} onClick={() => onSelect(type)}>
        <CommentReaction type={type} />
        {type[0].toUpperCase() + type.slice(1)}
      </button>
    ))}
  </div>
);

export default ReactionPicker;
