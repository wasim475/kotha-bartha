# KOTHA-BARTA

## Phase 1: Architecture Specification

Status: Approved baseline for implementation phases 2-20
Target: Mobile-first social networking and real-time messaging platform

## 1. System Architecture

KOTHA-BARTA is a two-application monorepo:

- `client`: React single-page application using JavaScript, Tailwind CSS, MUI, React Router, Axios, and Socket.io Client.
- `server`: Node.js and Express REST API using MongoDB/Mongoose, JWT, bcrypt, Cloudinary, and Socket.io.
- `MongoDB`: Source of truth for identity, relationships, content, messages, notifications, and durable user state.
- `Cloudinary`: Source of truth for uploaded profile, cover, and post media. MongoDB stores only validated asset metadata and URLs.
- `Socket.io`: Ephemeral realtime transport for messages, presence, typing, notifications, friendship events, and WebRTC signaling.
- `Redis` (recommended production dependency): Socket.io adapter, distributed presence counters, rate-limit storage, and short-lived idempotency state when more than one server instance is deployed.

Request flow:

1. Client sends an Axios request with an access token in an HttpOnly cookie.
2. Express applies CORS, security headers, request limits, authentication, validation, and route authorization.
3. Controllers call services. Services enforce domain rules and perform Mongoose queries in a repository-like boundary.
4. Successful mutations write MongoDB state first, then emit a durable-domain event through the Socket.io event publisher.
5. Socket handlers authenticate during handshake and call the same services as REST where a mutation is involved.
6. Client updates cached screens from REST responses and realtime events; realtime events are treated as hints and are safe to replay.

Production deployment uses a reverse proxy/TLS terminator, separately deployable client and API, managed MongoDB, Cloudinary, and horizontally scalable Socket.io server instances with a shared adapter.

Non-goals for Phase 1: microservices, event sourcing, end-to-end message encryption, and storing media binaries in MongoDB.

## 2. Folder Structure

```text
kotha-bartha/
  client/
    src/
      app/                 # providers, store, application bootstrap
      components/          # shared UI primitives
      pages/               # route-level screens
      layouts/             # auth and application shells
      features/
        auth/
        feed/
        friends/
        profile/
        search/
        messaging/
        notifications/
        calls/
      hooks/               # reusable React hooks
      context/             # theme and session contexts
      services/            # Axios API modules and upload client
      routes/              # route definitions and guards
      utils/               # formatting and client-only helpers
      socket/              # socket client, event subscriptions, reconnection
      assets/
      styles/
    public/
    package.json

  server/
    src/
      app.js               # Express application
      server.js            # HTTP and Socket.io startup
      config/               # environment, database, cloudinary
      controllers/
      models/
      routes/
      middlewares/          # auth, errors, validation, rate limits
      services/             # domain operations and event publishing
      sockets/              # auth, handlers, rooms, presence, calls
      validators/           # Joi/Zod/express-validator schemas
      utils/                # errors, pagination, ids, time
      jobs/                 # cleanup and notification maintenance jobs
      tests/
    package.json

  docs/
    api-openapi.yaml
    adr/                    # architecture decision records
  .env.example
  README.md
```

Controllers remain thin. Domain authorization belongs in services, not React components or route files. Socket handlers must not duplicate business rules.

## 3. Database Design

MongoDB uses ObjectId references, UTC timestamps, soft deletion where needed, and compound indexes matching access patterns. Every public identifier returned to the client is an ObjectId string or a generated opaque event id.

### User

```text
User {
  _id, fullName, email(normalized, unique), passwordHash,
  bio, avatar { publicId, secureUrl, width, height },
  cover { publicId, secureUrl, width, height },
  settings { theme: light|dark, rememberLogin: boolean },
  lastSeenAt, createdAt, updatedAt
}
```

Indexes: unique lowercase email; case-insensitive name search strategy; `lastSeenAt` only when needed for operational queries. Password hashes and Cloudinary secrets are never serialized.

### FriendRequest

```text
FriendRequest { _id, senderId, receiverId, status: pending|accepted|rejected|cancelled,
  createdAt, respondedAt, updatedAt }
```

One active request per unordered pair is enforced by service logic and a normalized pair key/index. Indexes: receiver/status/createdAt and sender/status/createdAt.

### Friendship

```text
Friendship { _id, userIds: [ObjectId, ObjectId], pairKey(unique), createdAt, updatedAt }
```

`userIds` is sorted before persistence. Index: unique `pairKey` and multikey `userIds`.

### Block

```text
Block { _id, blockerId, blockedId, pairKey(unique), createdAt }
```

A block is directional for administration, but access checks treat either direction as blocked. Indexes: blocker/createdAt, blocked/createdAt, pairKey.

### Post

```text
Post { _id, authorId, body, media { publicId, secureUrl, width, height, type },
  visibility: friends, deletedAt, createdAt, updatedAt }
```

Indexes: authorId/createdAt, createdAt, and optional text/name search indexes. Feed queries join only authors who are friends with the viewer and exclude blocked users.

### Comment

```text
Comment { _id, postId, authorId, body, deletedAt, createdAt, updatedAt }
```

Indexes: postId/createdAt and authorId/createdAt.

### Reaction

```text
Reaction { _id, userId, targetType: post|comment, targetId,
  type: like|love|care|haha, createdAt, updatedAt }
```

Unique index on userId/targetType/targetId. A change updates `type`; removal deletes the document.

### Conversation

```text
Conversation { _id, participantIds: [ObjectId, ObjectId], pairKey(unique),
  lastMessageId, lastMessageAt, unreadCounts: Map<userId, number>, createdAt, updatedAt }
```

Only two-person conversations are in scope. Index participantIds/updatedAt.

### Message

```text
Message { _id, conversationId, senderId, recipientId, body,
  status: sending|delivered|seen, deliveredAt, seenAt,
  editedAt, deletedAt, clientMessageId, createdAt, updatedAt }
```

Unique index on senderId/clientMessageId for retry idempotency. Index conversationId/createdAt and recipientId/status/createdAt.

### Notification

```text
Notification { _id, recipientId, actorId, type, entityType, entityId,
  uniqueEventId(unique), readAt, createdAt, payload }
```

`uniqueEventId` is deterministic for one domain action, for example `post:{postId}:like:{actorId}` or the mutation event id for messages. Unique insertion makes notification creation idempotent.

### Additional operational data

Refresh-token sessions are stored as hashed, revocable records if persistent sessions are required. Access JWTs remain short-lived. A TTL index can remove expired sessions and temporary call records.

## 4. Entity Relationships

```text
User 1--N Post
User 1--N Comment
User 1--N Reaction
User N--N User through Friendship
User 1--N FriendRequest as sender and receiver
User 1--N Block as blocker and blocked
Post 1--N Comment
Post 1--N Reaction
Comment 1--N Reaction
User N--N User through Conversation
Conversation 1--N Message
User 1--N Notification as recipient and actor
```

Relationship state is derived centrally in `relationshipService.getState(viewerId, targetId)` in this precedence order:

1. `BLOCKED` if either user has blocked the other.
2. `FRIEND` if a Friendship exists.
3. `REQUEST_SENT` if the viewer has a pending outgoing request.
4. `REQUEST_RECEIVED` if the target has a pending outgoing request.
5. `NOT_FRIEND` otherwise.

All search, profile, friends, feed, message, notification, and post authorization paths use this service or an equivalent server-side query predicate.

## 5. API Design

Base URL: `/api/v1`. JSON responses use `{ data, meta }`; errors use `{ error: { code, message, fields? } }`. List endpoints use `limit` plus opaque `cursor`, with a maximum page size of 50.

### Auth

- `POST /auth/register` - validate fields, hash password, create user, issue session.
- `POST /auth/login` - verify credentials, issue access token/session cookie.
- `POST /auth/logout` - revoke session and clear cookie.
- `GET /auth/me` - return current user and settings.

### Users and profile

- `GET /users/search?q=&cursor=` - normalized partial-name search with relationship state.
- `GET /users/:userId` - profile summary and relationship-aware profile data.
- `PATCH /users/me` - update name, bio, or settings.
- `POST /users/me/avatar` and `POST /users/me/cover` - validate and finalize Cloudinary upload.

### Friends and blocks

- `GET /friends?tab=friends|requests|sent`
- `POST /friends/requests` `{ receiverId }`
- `POST /friends/requests/:requestId/accept`
- `POST /friends/requests/:requestId/reject`
- `DELETE /friends/requests/:requestId`
- `DELETE /friends/:userId` - unfriend
- `POST /blocks/:userId`, `DELETE /blocks/:userId`

### Posts, comments, and reactions

- `GET /posts/feed?cursor=` and `GET /users/:userId/posts?cursor=`
- `POST /posts`, `PATCH /posts/:postId`, `DELETE /posts/:postId`
- `POST /posts/:postId/comments`, `PATCH /comments/:commentId`, `DELETE /comments/:commentId`
- `PUT /reactions/:targetType/:targetId` `{ type }`, `DELETE /reactions/:targetType/:targetId`
- `GET /reactions/:targetType/:targetId?cursor=`

The service rejects feed/profile/post/comment access when the viewer is not authorized, is blocked, or is not a friend where the resource is friends-only. Ownership is checked for edits and deletes.

### Messages

- `GET /conversations?cursor=`
- `GET /conversations/:conversationId/messages?cursor=`
- `POST /conversations/:conversationId/messages` `{ body, clientMessageId }`
- `PATCH /messages/:messageId`, `DELETE /messages/:messageId`
- `POST /messages/:messageId/delivered`
- `POST /messages/:messageId/seen`

Only friends may create or retrieve a conversation. Both participants may read status; only the sender may edit/delete its message, subject to a configured edit window.

### Notifications

- `GET /notifications?cursor=`
- `GET /notifications/unread-count`
- `POST /notifications/:notificationId/read`
- `POST /notifications/read-all`

Mutation endpoints return the durable result and the event id used for idempotency. HTTP retries with the same client id are safe where applicable.

## 6. Socket Architecture

Socket handshake authenticates a short-lived JWT or the same secure session cookie. The server loads the user, rejects blocked/invalid sessions, and joins:

- `user:{userId}` for personal events across all tabs/devices.
- `conversation:{conversationId}` only while a user is authorized to view it.
- `call:{callId}` for a call session.

Server-owned events:

```text
user_online, user_offline
receive_message, message_delivered, message_seen
friend_request_received, friend_request_accepted
notification_received
typing_start, typing_stop
call_offer, call_answer, call_rejected, call_end, ice_candidate
```

Client-to-server event names are the requested `send_message`, `message_delivered`, `message_seen`, `typing_start`, `typing_stop`, and call signaling events. The server validates every payload, authorizes the relationship, persists durable mutations through services, and broadcasts only to permitted rooms.

Presence uses a per-user connection count, not a boolean socket flag. Online is true while count > 0; last seen is written when the count reaches zero. Reconnects re-authenticate and resubscribe. Duplicate listeners are prevented by one socket provider and explicit unsubscribe functions.

Message delivery flow: sender sends `clientMessageId`; server creates one Message; recipient connection receives it; recipient acknowledges delivery; opening the conversation acknowledges seen. Every transition is conditional and idempotent.

## 7. Authentication Flow

1. Register validates name/email/password/confirmation, normalizes email, checks uniqueness, hashes with bcrypt, and creates the user.
2. Login validates credentials and issues a short-lived access JWT plus a revocable session/refresh token in an HttpOnly, Secure, SameSite cookie. Never store long-lived tokens in localStorage.
3. Axios sends credentials and uses a single 401 refresh/retry path; concurrent refreshes are coalesced.
4. `GET /auth/me` hydrates the session on startup. Protected React routes render only after the session check resolves.
5. Logout revokes the server session, clears the cookie, disconnects the socket, clears client auth/cache state, and immediately navigates to `/login`.
6. Remember Login controls session lifetime, not frontend token storage. Theme may be read from local storage before hydration and reconciled with the authenticated user's settings.

## 8. Authorization Rules

- Authentication is required for all application routes, sockets, and mutations except register/login.
- A user may read or change only their own private settings and profile-editable fields.
- A user may edit/delete only their own posts, comments, and messages.
- Friends-only posts, comments, reactions, conversations, and messages require an active friendship and no block in either direction.
- Blocked users cannot search each other, view restricted content, send/accept requests, message, react, comment, or receive relationship-dependent notifications.
- Friend request actions require the authenticated user to be the correct sender/receiver and the request to be pending.
- Uploads require authenticated ownership, MIME/type and size validation, server-generated Cloudinary signing, and safe transformed delivery URLs.
- Rate limits apply per IP and authenticated user to login/register, search, requests, posts, comments, reactions, messages, uploads, and socket events.
- Express validation rejects unknown or oversized fields. Mongo query operators are never accepted directly from user input.
- CORS allows only configured origins; TLS is mandatory in production; security headers and structured audit logging are enabled.

## 9. Notification Design

Domain services create notifications in the same logical mutation workflow as the triggering action. Each notification has a deterministic `uniqueEventId`; insertion uses a unique index and treats duplicate-key as an already-completed operation. Reconnects and React rerenders therefore cannot create duplicates.

Types: `friend_request`, `friend_request_accepted`, `post_like`, `post_comment`, `comment_reaction`, `new_message`.

Rules:

- Do not notify the actor about their own action.
- Do not notify across a block.
- Persist first, then emit `notification_received` to `user:{recipientId}`.
- The list endpoint is authoritative after reconnect.
- Read state is persisted with `readAt`; unread count is server-derived.
- Client navigation uses `entityType` and `entityId`, never an untrusted URL from payload data.

## 10. Messaging Architecture

Conversations are deterministic two-user records keyed by sorted participant ids, preventing duplicates under concurrent sends. A send operation accepts `clientMessageId` and is idempotent. The server persists the message, updates conversation summary/unread count, creates one notification when appropriate, then emits `receive_message`.

The client maintains one socket connection per browser session and a normalized message cache per conversation. Optimistic messages show `sending`, reconcile by `clientMessageId`, and become `delivered` or `seen` from server events. Failed sends remain retryable without creating a second message.

Typing events are ephemeral, rate-limited, scoped to an authorized conversation, and expire server/client-side after inactivity. New message audio is played only for a newly observed message id when the conversation is not active; event replay does not play it twice. Mobile chat uses a full-screen layout with a keyboard-safe composer.

## 11. Voice Call Architecture

Voice calls use WebRTC peer connections; Socket.io is signaling only and never carries audio. A caller creates a call record/state, sends `call_offer` to the authorized callee, and exchanges SDP answer and ICE candidates through the `call:{callId}` room.

State machine: `calling -> ringing -> accepted -> connected -> ended`; `ringing -> rejected|ended` and timeout transitions are terminal. Both peers can end a call. The server validates that both users are friends, not blocked, participants in the call, and that signaling messages belong to the active call. Signaling is ephemeral; call audit state may be retained with a TTL. Production deployment requires HTTPS/WSS and may require a TURN server for networks where direct ICE fails.

## 12. Responsive UI Plan

Mobile is the primary composition:

- Auth screens use a single-column form with accessible labels and inline validation.
- The authenticated shell has a compact top bar and fixed bottom navigation with safe-area padding. The five destinations are Feed, Friends, Messages, Notifications, and My Profile.
- Feed and lists use cursor pagination/infinite scroll, skeleton loading, pull-friendly spacing, and touch targets of at least 44px.
- Chat becomes full-screen on mobile; the composer uses `env(safe-area-inset-bottom)` and visual viewport-aware layout so the keyboard does not cover it.
- Profile and post media use responsive aspect ratios and Cloudinary transformations.

Tablet uses a wider content column with optional secondary panels. Desktop converts bottom navigation to a left navigation rail/sidebar, keeps the top bar, and uses a constrained multi-column layout: navigation, primary content, and contextual panel. MUI supplies accessible components and interaction states; Tailwind supplies responsive composition and design tokens. Light/dark theme tokens are shared between both systems and persisted locally plus in User.settings.

Route map:

```text
/login
/signup
/app/feed
/app/friends?tab=friends|requests|sent
/app/messages
/app/messages/:conversationId
/app/notifications
/app/profile/me
/app/profile/:userId
```

Unknown, unauthorized, and expired-session states have explicit error/loading/empty views. All icons have accessible labels or tooltips; keyboard navigation and reduced-motion preferences are supported.

## 13. Complete Development Roadmap

1. Architecture: this document, ADRs, OpenAPI and event contracts.
2. Backend setup: Express, config, Mongo connection, error handling, logging, validation, test harness.
3. Authentication: User model, register/login/me/logout, JWT/session middleware, protected routes.
4. Profile and Cloudinary: profile read/update, signed uploads, media validation.
5. Friend system: requests, friendship creation, lists, relationship service.
6. Search: debounced client search, pagination, relationship-aware actions.
7. Posts and feed: ownership, friends-only server filtering, media, cursor feed.
8. Comments and reactions: CRUD, reaction upsert/delete, counts and authorization.
9. Realtime messaging: conversation/message persistence, Socket.io auth, receive/send flow.
10. Seen and delivered: idempotent status transitions and unread counts.
11. Presence and typing: multi-tab counters, last seen, typing expiry.
12. Notifications: durable idempotent creation, realtime delivery, list/read navigation.
13. Block system: directional block records and enforcement across every module.
14. Voice calling: WebRTC peer flow, signaling, call state, TURN-ready deployment.
15. Dark mode: theme tokens, local persistence, user setting synchronization.
16. Mobile optimization: safe areas, keyboard handling, touch ergonomics, bundle/image tuning.
17. Desktop optimization: navigation rail, responsive multi-column layouts, keyboard workflows.
18. Security and performance: rate limits, abuse controls, indexes, caching, observability, load tests.
19. Testing: unit, integration, API authorization matrix, socket tests, browser E2E, accessibility, responsive checks.
20. Production deployment: CI/CD, environment secrets, TLS, Mongo/Cloudinary/Redis setup, migrations, backups, monitoring, rollback runbook.

Definition of done for every phase: implementation, focused tests, authorization tests for both allowed and denied paths, API/event documentation updates, responsive behavior where applicable, and no known duplicate side effects under retry or reconnect.

## Phase 1 Exit Criteria

- This architecture is reviewed and accepted as the implementation baseline.
- The API and socket names, relationship precedence, authorization rules, and notification idempotency contract are stable.
- Environment requirements are identified: MongoDB, Cloudinary, JWT/session secrets, allowed origins, and production Redis/TURN where required.
- Phase 2 may begin with backend scaffolding; no feature implementation is included in Phase 1.
