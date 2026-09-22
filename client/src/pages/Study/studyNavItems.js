import {
  Article,
  AutoAwesome,
  Leaderboard as LeaderboardIcon,
  Quiz,
  School,
  SportsEsports,
} from "@mui/icons-material";

export const studyNavItems = [
  { label: "Blogs", path: "/study/blogs", icon: Article, key: "blogs" },
  { label: "Quiz", path: "/study/quiz", icon: Quiz, key: "quiz" },
  {
    label: "Class Study",
    path: "/study/class-study",
    icon: School,
    key: "class-study",
  },
  { label: "Games", path: "/study/games", icon: SportsEsports, key: "games" },
  {
    label: "Study AI",
    path: "/study/study-ai",
    icon: AutoAwesome,
    key: "study-ai",
  },
  {
    label: "Leaderboard",
    path: "/study/leaderboard",
    icon: LeaderboardIcon,
    key: "leaderboard",
  },
];
