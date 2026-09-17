import AuthArt from "./components/AuthArt";
import AuthBrand from "./components/AuthBrand";
import AuthForm from "./components/AuthForm";
import AuthSwitch from "./components/AuthSwitch";
import useAuthForm from "./hooks/useAuthForm";

export default function AuthPage({ mode, onAuth }) {
  const signup = mode === "signup";
  const { form, error, busy, update, submit } = useAuthForm({
    signup,
    onAuth,
  });

  return (
    <main className="auth-page">
      <AuthArt />

      <section className="auth-panel">
        <AuthBrand />

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

        <AuthForm
          signup={signup}
          form={form}
          error={error}
          busy={busy}
          update={update}
          onSubmit={submit}
        />

        <AuthSwitch signup={signup} />
      </section>
    </main>
  );
}
