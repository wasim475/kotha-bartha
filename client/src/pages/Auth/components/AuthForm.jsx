import { Send, Visibility, VisibilityOff } from "@mui/icons-material";
import { useState } from "react";
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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const passwordToggle = (visible, setVisible) => (
    <button
      type="button"
      className="auth-password-toggle"
      aria-label={visible ? "Hide password" : "Show password"}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => setVisible((current) => !current)}
    >
      {visible ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
    </button>
  );

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
        <span className="auth-password-field">
          <input
            required
            type={passwordVisible ? "text" : "password"}
            minLength="8"
            autoComplete={signup ? "new-password" : "current-password"}
            value={form.password}
            onChange={update("password")}
            placeholder="8 characters minimum"
          />
          {passwordToggle(passwordVisible, setPasswordVisible)}
        </span>
      </label>

      {signup && (
        <label>
          Confirm password
          <span className="auth-password-field">
            <input
              required
              type={confirmPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={update("confirmPassword")}
              placeholder="Repeat your password"
            />
            {passwordToggle(confirmPasswordVisible, setConfirmPasswordVisible)}
          </span>
        </label>
      )}

      

      {error && <div className="form-error">{error}</div>}

      <button className="primary-button" disabled={busy}>
        {busy ? "Please wait..." : signup ? "Create account" : "Sign in"}{" "}
        <Send fontSize="small" />
      </button>
      <div className="flex items-center gap-1">
  <div className="flex-1 h-px bg-gray-300" />
  
  <span className="text-sm text-gray-500">
    Or
  </span>
  
  <div className="flex-1 h-px bg-gray-300" />
</div>
      <div className="flex justify-center">
         <GoogleLoginButton
        onSuccess={onGoogleLogin}
      />
      </div>
    </form>
  );
}
