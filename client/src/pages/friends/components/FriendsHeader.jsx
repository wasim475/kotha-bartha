import { PersonAddAlt } from "@mui/icons-material";

const FriendsHeader = ({ onFindPeople }) => (
  <div className="page-heading">
    <div>
      <span className="eyebrow">Your circle</span>
      <h1>Friends</h1>
    </div>

    <button type="button" className="outline-button" onClick={onFindPeople}>
      <PersonAddAlt fontSize="small" />
      Find people
    </button>
  </div>
);

export default FriendsHeader;
