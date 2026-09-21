import { useNavigate } from "react-router-dom";

export default function AuthSwitch({ signup }) {
  const navigate = useNavigate();

  return (
    <p className="auth-switch">
      {signup ? "Already have an account?" : "New to Kotha-Barta?"}{" "}
      <button onClick={() => navigate(signup ? "/login" : "/signup")}>
        {signup ? "Sign in" : "Create an account"}
      </button>
    </p>
  );
}
