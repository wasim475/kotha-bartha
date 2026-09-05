import {
  Add,
  ChatBubble,
  DarkMode,
  Home,
  Logout,
  Menu,
  MoreHoriz,
  NotificationsNone,
  PeopleAlt,
  PersonAddAlt,
  Search,
  Send,
  Settings,
  ThumbUpAlt,
  WbSunny,
} from "@mui/icons-material";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";

const api = axios.create({
  baseURL: "https://kotha-bartha.onrender.com/api/v1",
  withCredentials: true,
});
const navItems = [
  { label: "Feed", path: "/app/feed", icon: Home },
  { label: "Friends", path: "/app/friends", icon: PeopleAlt },
  { label: "Messages", path: "/app/messages", icon: ChatBubble },
  { label: "Alerts", path: "/app/notifications", icon: NotificationsNone },
  { label: "Profile", path: "/app/profile/me", icon: PersonAddAlt },
];
const colorNames = ["blue", "gold", "mint", "coral"];
const colorFor = (id = "") =>
  colorNames[Number.parseInt(String(id).slice(-2), 16) % colorNames.length] ||
  "blue";
const formatTime = (date) =>
  date
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        -Math.round((Date.now() - new Date(date).getTime()) / 60000),
        "minute",
      )
    : "";

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(
    localStorage.getItem("kotha-theme") || "light",
  );
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("kotha-theme", theme);
  }, [theme]);
  useEffect(() => {
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data.data))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
  };
  if (checking)
    return (
      <div className="loading-screen">
        <span className="brand-mark">K</span>
        <p>Preparing your space...</p>
      </div>
    );
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/app/feed" />
            ) : (
              <AuthPage mode="login" onAuth={setUser} />
            )
          }
        />
        <Route
          path="/signup"
          element={
            user ? (
              <Navigate to="/app/feed" />
            ) : (
              <AuthPage mode="signup" onAuth={setUser} />
            )
          }
        />
        <Route
          path="/app/*"
          element={
            user ? (
              <Shell
                user={user}
                onLogout={logout}
                theme={theme}
                setTheme={setTheme}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? "/app/feed" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

function AuthPage({ mode, onAuth }) {
  const navigate = useNavigate();
  const signup = mode === "signup";
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(
        `/auth/${signup ? "register" : "login"}`,
        form,
      );
      onAuth(data.data);
      navigate("/app/feed");
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          "The server is unavailable. Start the API and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-art">
        <span className="eyebrow">A softer social space</span>
        <h1>
          Say more.
          <br />
          <em>Mean it.</em>
        </h1>
        <p>
          Stay close to the people and moments that make the ordinary feel like
          yours.
        </p>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
      </div>
      <section className="auth-panel">
        <div className="wordmark">
          <span className="brand-mark">K</span>
          <span>
            KOTHA<span>-BARTA</span>
          </span>
        </div>
        <div className="auth-copy">
          <span className="eyebrow">
            {signup ? "Create your account" : "Welcome back"}
          </span>
          <h2>{signup ? "Find your people." : "Good to see you."}</h2>
          <p>
            {signup
              ? "Your corner of the internet starts here."
              : "Your conversations are waiting."}
          </p>
        </div>
        <form onSubmit={submit} className="auth-form">
          {signup && (
            <label>
              Full name
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Aisha Rahman"
              />
            </label>
          )}
          <label>
            Email address
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              minLength="8"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="8 characters minimum"
            />
          </label>
          {signup && (
            <label>
              Confirm password
              <input
                required
                type="password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                placeholder="Repeat your password"
              />
            </label>
          )}
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" disabled={busy}>
            {busy ? "Please wait..." : signup ? "Create account" : "Sign in"}{" "}
            <Send fontSize="small" />
          </button>
        </form>
        <p className="auth-switch">
          {signup ? "Already have an account?" : "New to Kotha-Barta?"}{" "}
          <button onClick={() => navigate(signup ? "/login" : "/signup")}>
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}

function Shell({ user, onLogout, theme, setTheme }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  useEffect(() => {
    if (!search.trim()) return undefined;
    const timer = setTimeout(
      () =>
        api
          .get(`/users/search?q=${encodeURIComponent(search)}`)
          .then(({ data }) => setSearchResults(data.data))
          .catch(() => setSearchResults([])),
      300,
    );
    return () => clearTimeout(timer);
  }, [search]);
  const active =
    navItems.find((item) => location.pathname.startsWith(item.path)) ||
    navItems[0];
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open menu">
          <Menu />
        </button>
        <button
          className="wordmark compact"
          onClick={() => navigate("/app/feed")}
        >
          <span className="brand-mark">K</span>
          <span>
            KOTHA<span>-BARTA</span>
          </span>
        </button>
        <div className="search-box search-wrap">
          <Search fontSize="small" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value.trim()) setSearchResults([]);
            }}
            placeholder="Search people, moments..."
          />
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    navigate(`/app/profile/${result.id}`);
                    setSearch("");
                  }}
                >
                  <span className={`avatar avatar-${colorFor(result.id)}`}>
                    {result.initials}
                  </span>
                  <strong>{result.fullName}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="top-actions">
          <button
            className="icon-button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label="Toggle theme"
          >
            {theme === "light" ? <DarkMode /> : <WbSunny />}
          </button>
          <button
            className="avatar avatar-coral"
            onClick={() => navigate("/app/profile/me")}
            aria-label="Open profile"
          >
            {user.fullName.slice(0, 2).toUpperCase()}
          </button>
        </div>
      </header>
      <div className="app-body">
        <aside className="desktop-nav">
          <p className="nav-label">Your space</p>
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              active={active.path === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
          <div className="nav-bottom">
            <button
              className="nav-item"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Settings fontSize="small" />
              <span>Preferences</span>
            </button>
            <button className="nav-item" onClick={onLogout}>
              <Logout fontSize="small" />
              <span>Log out</span>
            </button>
          </div>
        </aside>
        <main className="page-content">
          <Routes>
            <Route path="feed" element={<Feed user={user} />} />
            <Route path="friends" element={<Friends />} />
            <Route path="messages" element={<Messages />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile/:id" element={<Profile user={user} />} />
            <Route path="*" element={<Navigate to="feed" replace />} />
          </Routes>
        </main>
      </div>
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={active.path === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>
    </div>
  );
}
function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon">
        <Icon fontSize="small" />
        {item.badge && <b>{item.badge}</b>}
      </span>
      <span>{item.label}</span>
    </button>
  );
}
function useResource(url) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const reload = () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    api
      .get(url)
      .then(({ data }) =>
        setState({ data: data.data, loading: false, error: "" }),
      )
      .catch((error) =>
        setState({
          data: null,
          loading: false,
          error: error.response?.data?.error?.message || "Unable to load data.",
        }),
      );
  };
  useEffect(() => {
    let active = true;
    api
      .get(url)
      .then(({ data }) => {
        if (active) setState({ data: data.data, loading: false, error: "" });
      })
      .catch((error) => {
        if (active)
          setState({
            data: null,
            loading: false,
            error:
              error.response?.data?.error?.message || "Unable to load data.",
          });
      });
    return () => {
      active = false;
    };
  }, [url]);
  return { ...state, reload };
}
function ResourceState({ loading, error, empty, children }) {
  if (loading)
    return (
      <div className="empty-note">
        <p>Loading...</p>
      </div>
    );
  if (error)
    return (
      <div className="empty-note">
        <p>{error}</p>
      </div>
    );
  if (empty)
    return (
      <div className="empty-note">
        <p>{empty}</p>
      </div>
    );
  return children;
}
function Feed({ user }) {
  const resource = useResource("/posts/feed");
  const [composer, setComposer] = useState("");
  const [busy, setBusy] = useState(false);
  const [postError, setPostError] = useState("");
  const createPost = async () => {
    if (!composer.trim()) {
      setPostError("Write something before posting.");
      return;
    }
    setBusy(true);
    setPostError("");
    try {
      await api.post("/posts", { body: composer.trim() });
      setComposer("");
      resource.reload();
    } catch (error) {
      setPostError(
        error.response?.data?.error?.message || "Post could not be published.",
      );
    } finally {
      setBusy(false);
    }
  };
  const toggleLike = async (post) => {
    await api.put(`/posts/${post.id}/like`, { liked: !post.liked });
    resource.reload();
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Your people</span>
          <h1>Your feed</h1>
        </div>
        <button className="primary-button small" onClick={createPost}>
          <Add fontSize="small" /> Create post
        </button>
      </div>
      <section className="composer">
        <div className="avatar avatar-coral">
          {user.fullName.slice(0, 2).toUpperCase()}
        </div>
        <textarea
          value={composer}
          onChange={(event) => {
            setComposer(event.target.value);
            setPostError("");
          }}
          placeholder={`What is on your mind, ${user.fullName.split(" ")[0]}?`}
          rows="2"
        />
        <div className="composer-actions">
          <button disabled={busy} onClick={createPost}>
            <Send /> {busy ? "Posting..." : "Post"}
          </button>
        </div>
        {postError && (
          <div className="form-error composer-error">{postError}</div>
        )}
      </section>
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        empty="No posts yet. Add a friend or share the first post."
      >
        {resource.data?.map((post) => (
          <article className="post-card" key={post.id}>
            <div className="post-header">
              <div className={`avatar avatar-${colorFor(post.author.id)}`}>
                {post.author.initials}
              </div>
              <div>
                <strong>{post.author.fullName}</strong>
                <span>{formatTime(post.createdAt)}</span>
              </div>
              <button className="more-button">
                <MoreHoriz />
              </button>
            </div>
            <p className="post-body">{post.body}</p>
            {post.media?.secureUrl && (
              <img
                className="post-media"
                src={post.media.secureUrl}
                alt="Post attachment"
              />
            )}
            <div className="post-stats">
              <span>
                <ThumbUpAlt fontSize="inherit" /> {post.likes}
              </span>
              <span>{post.comments} comments</span>
            </div>
            <div className="post-actions">
              <button
                className={post.liked ? "selected" : ""}
                onClick={() => toggleLike(post)}
              >
                <ThumbUpAlt fontSize="small" /> Like
              </button>
              <button>
                <ChatBubble fontSize="small" /> Comment
              </button>
              <button>
                <Send fontSize="small" /> Share
              </button>
            </div>
          </article>
        ))}
      </ResourceState>
    </>
  );
}
function Friends() {
  const [tab, setTab] = useState("friends");
  const resource = useResource(`/friends?tab=${tab}`);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Your circle</span>
          <h1>Friends</h1>
        </div>
        <button className="outline-button">
          <PersonAddAlt fontSize="small" /> Find people
        </button>
      </div>
      <div className="tabs">
        <button
          className={tab === "friends" ? "tab-active" : ""}
          onClick={() => setTab("friends")}
        >
          All friends
        </button>
        <button
          className={tab === "requests" ? "tab-active" : ""}
          onClick={() => setTab("requests")}
        >
          Requests
        </button>
        <button
          className={tab === "sent" ? "tab-active" : ""}
          onClick={() => setTab("sent")}
        >
          Sent
        </button>
      </div>
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        empty={`No ${tab} to show.`}
      >
        <div className="friend-grid">
          {resource.data?.map((entry) => {
            const person = entry.user || entry;
            return (
              <div className="friend-card" key={entry.id || person.id}>
                <div className={`avatar avatar-${colorFor(person.id)}`}>
                  {person.initials}
                </div>
                <strong>{person.fullName}</strong>
                <span>{entry.status || "Friend"}</span>
                <button className="outline-button">
                  {tab === "friends"
                    ? "Message"
                    : tab === "requests"
                      ? "Accept"
                      : "Cancel"}
                </button>
              </div>
            );
          })}
        </div>
      </ResourceState>
    </>
  );
}
function Messages() {
  const resource = useResource("/conversations");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Keep in touch</span>
          <h1>Messages</h1>
        </div>
        <button className="icon-button">
          <Add />
        </button>
      </div>
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        empty="No conversations yet. Message a friend to start chatting."
      >
        <div className="message-list">
          {resource.data?.map((conversation) => (
            <button
              className={`conversation ${conversation.unreadCount ? "unread" : ""}`}
              key={conversation.id}
            >
              <div
                className={`avatar avatar-${colorFor(conversation.user.id)}`}
              >
                {conversation.user.initials}
                <i />
              </div>
              <div>
                <strong>{conversation.user.fullName}</strong>
                <span>{conversation.lastMessage || "No messages yet"}</span>
              </div>
              <time>{formatTime(conversation.lastMessageAt)}</time>
              {conversation.unreadCount > 0 && (
                <b>{conversation.unreadCount}</b>
              )}
            </button>
          ))}
        </div>
      </ResourceState>
    </>
  );
}
function Notifications() {
  const resource = useResource("/notifications");
  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    resource.reload();
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Stay in the loop</span>
          <h1>Notifications</h1>
        </div>
        <button className="text-button" onClick={markAllRead}>
          Mark all read
        </button>
      </div>
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        empty="You are all caught up."
      >
        <div className="notification-list">
          {resource.data?.map((notification) => (
            <div
              className={`notification ${notification.read ? "" : "unread"}`}
              key={notification.id}
            >
              <div
                className={`avatar avatar-${colorFor(notification.actor?.id)}`}
              >
                {notification.actor?.initials || "KB"}
              </div>
              <div>
                <strong>
                  {notification.payload?.message || notification.type}
                </strong>
                <span>{formatTime(notification.createdAt)}</span>
              </div>
              {!notification.read && <i />}
            </div>
          ))}
        </div>
      </ResourceState>
    </>
  );
}
function Profile({ user }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(user.bio || "");
  const [savedBio, setSavedBio] = useState(user.bio || "");
  const save = async () => {
    const { data } = await api.patch("/users/me", { bio });
    setSavedBio(data.data.bio);
    setEditing(false);
  };
  return (
    <>
      <div className="profile-cover">
        <div className="cover-text">
          {user.fullName.toLowerCase()} / in public
        </div>
      </div>
      <div className="profile-identity">
        <div className="avatar avatar-coral profile-avatar">
          {user.fullName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1>{user.fullName}</h1>
          <p>{savedBio || "No bio yet."}</p>
        </div>
        <button className="outline-button" onClick={() => setEditing(!editing)}>
          Edit profile
        </button>
      </div>
      {editing && (
        <div className="composer profile-editor">
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows="3"
          />
          <button className="primary-button small" onClick={save}>
            Save profile
          </button>
        </div>
      )}
      <div className="profile-tabs">
        <button className="tab-active">About</button>
      </div>
      <div className="profile-grid">
        <div className="profile-about">
          <span className="eyebrow">About</span>
          <p>{savedBio || "This user has not added a bio yet."}</p>
        </div>
      </div>
    </>
  );
}
export default App;
