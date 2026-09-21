import { GoogleLogin } from "@react-oauth/google";

export default function GoogleLoginButton({ onSuccess }) {
  return (
    <div className="google-login">
      <GoogleLogin
        onSuccess={onSuccess}
        onError={() => {
          console.log("Google Login Failed");
        }}
      />
    </div>
  );
}