import { Send } from "@mui/icons-material";
import GoogleLoginButton from './GoogleLogin';

export default function AuthForm({
  signup,
  form,
  error,
  busy,
  update,
  onSubmit,
  onGoogleLogin,
}) {
  return (
    <form onSubmit={onSubmit} className="auth-form">
      {signup && (
        <label>
          Full name
          <input
            required
            value={form.fullName}
            onChange={update("fullName")}
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
          onChange={update("email")}
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
          onChange={update("password")}
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
            onChange={update("confirmPassword")}
            placeholder="Repeat your password"
          />
        </label>
      )}

       <GoogleLoginButton
        onSuccess={onGoogleLogin}
      />

      {error && <div className="form-error">{error}</div>}

      <button className="primary-button" disabled={busy}>
        {busy ? "Please wait..." : signup ? "Create account" : "Sign in"}{" "}
        <Send fontSize="small" />
      </button>
    </form>
  );
}
