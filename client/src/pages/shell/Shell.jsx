import { DarkMode, Menu, Search, WbSunny } from "@mui/icons-material";
import { io } from "socket.io-client";
import { useContext, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Utility } from "../../provider/UtilityProvider";
import { api } from "../../utility/api";
import { colorFor, realtime, setActiveSocket } from "../../utility/helpers";
import Navbar from "../SharePage/Navbar";
import Message from "../message/Message";
import Feed from "../feed/Feed";
import Friends from "../friends/Friends";
import Notifications from "../notifications/Notifications";
import Profile from "../profile/Profile";

const socketUrl = api.defaults.baseURL.replace(/\/api\/v1$/, "");

export default function Shell({ user, onLogout }) {
  const navigate = useNavigate(); const { theme, setTheme } = useContext(Utility);
  const [search, setSearch] = useState(""); const [results, setResults] = useState([]);
  useEffect(() => { const socket = io(socketUrl, { withCredentials: true }); setActiveSocket(socket); const forward = (name) => (payload) => realtime.dispatchEvent(new CustomEvent(name, { detail: payload })); socket.on("connect", forward("realtime:connected")); socket.on("message:new", forward("message:new")); socket.on("notification:new", forward("notification:new")); socket.on("call:signal", forward("call:signal")); return () => { setActiveSocket(undefined); socket.disconnect(); }; }, [user.id]);
  useEffect(() => { if (!search.trim()) return undefined; const timer = setTimeout(() => api.get(`/users/search?q=${encodeURIComponent(search)}`).then(({ data }) => setResults(data.data)).catch(() => setResults([])), 300); return () => clearTimeout(timer); }, [search]);
  return <div className="app-shell"><header className="topbar"><button className="mobile-menu" aria-label="Open menu"><Menu /></button><button className="wordmark compact" onClick={() => navigate("/app/feed")}><span className="brand-mark">K</span><span>KOTHA<span>-BARTA</span></span></button><div className="search-box search-wrap"><Search fontSize="small" /><input value={search} onChange={(event) => { setSearch(event.target.value); if (!event.target.value.trim()) setResults([]); }} placeholder="Search people, moments..." />{results.length > 0 && <div className="search-results">{results.map((person) => <button key={person.id} onClick={() => { navigate(`/app/profile/${person.id}`); setSearch(""); setResults([]); }}><span className={`avatar avatar-${colorFor(person.id)}`}>{person.initials}</span><strong>{person.fullName}</strong></button>)}</div>}</div><div className="top-actions"><button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle theme">{theme === "light" ? <DarkMode /> : <WbSunny />}</button><button className="avatar avatar-coral" onClick={() => navigate("/app/profile/me")}>{user.fullName.slice(0, 2).toUpperCase()}</button></div></header><div className="app-body"><Navbar onLogout={onLogout} /><main className="page-content"><Routes><Route path="feed" element={<Feed user={user} />} /><Route path="friends" element={<Friends />} /><Route path="messages" element={<Message user={user} />} /><Route path="messages/:conversationId" element={<Message user={user} />} /><Route path="notifications" element={<Notifications />} /><Route path="profile/:id" element={<Profile user={user} />} /><Route path="*" element={<Navigate to="feed" replace />} /></Routes></main></div></div>;
}
