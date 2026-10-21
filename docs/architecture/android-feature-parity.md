# Android and Web feature parity

Static review of the existing Android app and Web routes/components, 2026-10-21. `Complete` means a user-facing Android flow is present for the named core feature; it does not claim pixel parity or device-level verification.

| Area | Status | Android coverage and remaining Web gaps |
| --- | --- | --- |
| Authentication | Partial | Email/password, Google sign-in, session restore, and logout exist. Web account recovery and other account flows need a dedicated parity pass. |
| Profile | Partial | Profile view/edit and friend actions exist. Web profile photos/posts and account controls are not fully represented in the Android UI. |
| Feed and posts | Partial | Feed, post details, and basic post interaction exist. Web media, story/note context, and the full comment/reply/reaction surface need comparison. |
| Friends and requests | Partial | Friend list, requests, search, and profile-level unfriend flows exist. Blocking and all Web moderation states need verification in Android. |
| Notifications | Partial | In-app list and unread counts exist. FCM registration, OS notifications, and notification deep links are missing. |
| One-to-one messaging | Partial | Conversation/history, text, image attachment, read/typing events, and reactions exist. Broader Web attachment features and Android E2E decryption remain incomplete. |
| Audio/video calling | Partial | Shared call signaling, foreground incoming UI, controls, call history, and in-call chat/reactions exist. Background/locked incoming calls and real network traversal remain unverified; TURN is not configured in Android. |
| Courses and lessons | Missing | Android Study currently links Quiz, games, leaderboards, Tic-Tac-Toe, and Ludo; it does not expose Web Courses, lesson editor/viewer, or lesson tests. |
| Quiz | Partial | Browse and play flows exist. Compare all Web authoring, attempt history, and result details before claiming parity. |
| Games and challenges | Partial | English/Math games, friend challenges, Tic-Tac-Toe, and Ludo flows exist. Web game catalog and all result/review variants need a parity pass. |
| Leaderboards | Partial | A leaderboard screen and API exist. Full Web filters and ranking details were not exhaustively verified. |
| Settings and theme | Partial | Light/dark theme toggle and logout exist. A full settings/privacy/preferences screen is missing. |
| Stories and Notes | Missing | Web has these user-facing flows; no corresponding Android feature module or navigation flow was found. |

The next implementation priorities are FCM plus conversation deep links, background call notifications, Courses/lesson views and tests, then Stories/Notes and the remaining profile/feed/settings gaps. This is an inventory, not a claim those features were ported in this change.
