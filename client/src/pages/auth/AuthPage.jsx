import { Send } from "@mui/icons-material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../utility/api";

export default function AuthPage({ mode, onAuth }) {
  const navigate = useNavigate();
  const signup = mode === "signup";
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const { data } = await api.post(`/auth/${signup ? "register" : "login"}`, form); onAuth(data.data); navigate("/app/feed"); }
    catch (requestError) { setError(requestError.response?.data?.error?.message || "The server is unavailable. Start the API and try again."); }
    finally { setBusy(false); }
  };
  return <main className="auth-page"><div className="auth-art"><span className="eyebrow">A softer social space</span><h1>Say more.<br /><em>Mean it.</em></h1><p>Stay close to the people and moments that make the ordinary feel like yours.</p><div className="orbit orbit-one" /><div className="orbit orbit-two" /></div><section className="auth-panel"><div className="wordmark"><span className="brand-mark">K</span><span>KOTHA<span>-BARTA</span></span></div><div className="auth-copy"><span className="eyebrow">{signup ? "Create your account" : "Welcome back"}</span><h2>{signup ? "Find your people." : "Good to see you."}</h2><p>{signup ? "Your corner of the internet starts here." : "Your conversations are waiting."}</p></div><form onSubmit={submit} className="auth-form">{signup && <label>Full name<input required value={form.fullName} onChange={update("fullName")} placeholder="e.g. Aisha Rahman" /></label>}<label>Email address<input required type="email" value={form.email} onChange={update("email")} placeholder="you@example.com" /></label><label>Password<input required type="password" minLength="8" value={form.password} onChange={update("password")} placeholder="8 characters minimum" /></label>{signup && <label>Confirm password<input required type="password" value={form.confirmPassword} onChange={update("confirmPassword")} placeholder="Repeat your password" /></label>}{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={busy}>{busy ? "Please wait..." : signup ? "Create account" : "Sign in"} <Send fontSize="small" /></button></form><p className="auth-switch">{signup ? "Already have an account?" : "New to Kotha-Barta?"} <button onClick={() => navigate(signup ? "/login" : "/signup")}>{signup ? "Sign in" : "Create an account"}</button></p></section></main>;
}
