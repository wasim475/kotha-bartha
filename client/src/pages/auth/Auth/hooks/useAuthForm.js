import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../utility/api";

export default function useAuthForm({ signup, onAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });

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

   // Google Login
  const googleLogin = async (credentialResponse) => {
    setBusy(true);
    setError("");

    try {
      const { data } = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });

      onAuth(data.data);
      navigate("/app/feed");
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ||
          "Google login failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return { form, error, busy, update, submit,googleLogin };
}
