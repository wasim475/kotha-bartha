# Android games architecture — server-authoritative boundary

The single rule this document exists to enforce: **Android renders server state and sends user actions; it never independently computes a winner, score, reward, leaderboard point, turn validity, dice validity, token-movement validity, quiz correctness, or challenge result.** Every game already follows this today on the web client — nothing here changes that, this document just makes the boundary explicit so it isn't accidentally violated when Android is built.

## Quiz

Question banks and chapter/set structure live in `Subject`/`Chapter`/`QuizQuestion` models. `POST /quiz/chapters/:chapterId/sets/:setNumber/start` creates a `QuizAttempt`; `POST /quiz/attempts/:attemptId/answer` is where correctness is actually decided — server-side, inside that route handler, against the stored question's answer key. Android submits the user's selected answer and displays whatever the response says (correct/incorrect, running score); it must never grade the answer locally, even for instant UI feedback — any "instant" feedback should optimistically show a pending state and reconcile with the server's response, not pre-judge it.

## English / Math games

`server/src/services/games/{mathGenerator,englishBanks,questionBuilder}.js` generate questions server-side (`GameAttempt`/`Game` models track sessions). Same rule as Quiz: Android receives a generated question, submits an answer, and displays the server's verdict.

## Tic-Tac-Toe

`server/src/services/ticTacToe/logic.js` is the sole authority on move legality and win/draw detection. The socket contract (`ticTacToe:move` → server validates → broadcasts `ticTacToe:state` with the new authoritative board) means Android's board UI is a pure function of the last `ticTacToe:state` it received, never a locally-simulated board that gets corrected after the fact. `TicTacToeGame`/`TicTacToeInvite` models hold the durable record; `GET /games/tic-tac-toe/stats` is the server-computed stats surface — Android never tallies wins/losses itself.

## Ludo

`server/src/games/ludo/engine.js` (shared, versioned engine — see `LUDO.md` and `server/package.json`'s `sync:ludo` script, which keeps a client-side copy of the engine in sync for the web client's own local animation/prediction) owns dice-roll RNG, token-movement legality, capture detection, and turn order. The web client does maintain a synced copy of this exact engine (`client/src/games/ludo/`) purely to animate moves smoothly client-side *before* the server's `ludo:state` confirms them — but the server's state is always the reconciled truth; the client-side engine copy is a rendering optimization, not a second source of authority. If Android wants the same smooth-animation optimization later, it would need its own Kotlin port of the same engine logic kept in sync the same deliberate way — but that is an optional rendering nicety for a future phase, not something to build now, and even then the server's `ludo:state` must always win on any discrepancy.

## Game Challenges (friend Math/English head-to-head)

`gameChallenge.service.js` + the `services/games/*` generators decide questions and grade answers exactly as in solo Quiz/Math/English play; the socket contract (`gameChallenge:question` → `gameChallenge:send` → `gameChallenge:questionResult`) means Android again only ever renders the server's verdict, never grades an opponent's or its own answer locally.

## Leaderboard

`LeaderboardArchive`/`leaderboardRanking.service.js`/`leaderboardCycle.service.js` compute rankings and archive monthly cycles entirely server-side, on a schedule (`startLeaderboardArchiveScheduler`, started once in `server.js` regardless of client type). `GET /leaderboard/top`/`.../users/:userId/stats`/`.../archive/*` are pure reads — Android has no reason to ever compute a rank or point total client-side, and no endpoint exists (or should exist) for a client to submit one.

## What this means for `android/feature/{tic_tac_toe,ludo,games,quiz,leaderboard}`

Each of these feature modules' eventual repository layer should be a thin translation between REST/socket payloads and UI state — no rules engine, no scoring logic, no RNG beyond what's needed for non-authoritative cosmetic effects (e.g. a confetti animation triggered by a server-confirmed win, never a locally-decided one).
