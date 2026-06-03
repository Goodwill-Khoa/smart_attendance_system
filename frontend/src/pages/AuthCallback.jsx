import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import BaseLayout, { responsiveButtonStyle } from "../components/BaseLayout";
import { AUTH_ROLES, clearAuthRole, setAuthRole } from "../services/authRole";
import { getApiBaseUrl } from "../services/apiBase";
import { syncAuthenticatedUser } from "../services/authSync";

export default function AuthCallback() {
  const navigate = useNavigate();
  const BASE_URL = getApiBaseUrl();
  const [statusMessage, setStatusMessage] = useState("Completing sign-in...");

  useEffect(() => {
    const finishOAuthSignIn = async () => {
      const resolveOAuthEmail = (oauthUser) => {
        return (
          oauthUser?.email ||
          oauthUser?.user_metadata?.email ||
          oauthUser?.user_metadata?.preferred_username ||
          oauthUser?.user_metadata?.custom_claims?.email ||
          oauthUser?.user_metadata?.upn ||
          oauthUser?.identities?.[0]?.identity_data?.email ||
          oauthUser?.identities?.[0]?.identity_data?.preferred_username ||
          oauthUser?.identities?.[0]?.identity_data?.upn ||
          ""
        )
          .toString()
          .trim()
          .toLowerCase();
      };

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      let session = null;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setStatusMessage(error.message || "Authentication failed.");
          return;
        }

        session = data.session;
      } else {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setStatusMessage(error.message || "Authentication failed.");
          return;
        }

        session = data.session;
      }

      const user = session?.user;
      const email = resolveOAuthEmail(user);

      if (!email) {
        await supabase.auth.signOut();
        clearAuthRole();
        navigate("/login", {
          replace: true,
          state: { error: "Cannot read your account email from the SSO provider." },
        });
        return;
      }

      const isElteStudentEmail = /^[^@]+@(?:[a-z0-9-]+\.)*elte\.hu$/i.test(email);
      if (!isElteStudentEmail) {
        await supabase.auth.signOut();
        clearAuthRole();
        navigate("/login", {
          replace: true,
          state: { error: "Use an @elte.hu or *.elte.hu account for student sign in." },
        });
        return;
      }

      try {
        const params = new URLSearchParams({ email });
        const lecturerRes = await fetch(`${BASE_URL}/lecturers/password-policy?${params.toString()}`);
        const lecturerData = await lecturerRes.json().catch(() => ({}));
        const lecturerProfileExists =
          lecturerRes.ok &&
          Boolean(lecturerData.title || lecturerData.fullName || lecturerData.mustChangePassword);

        if (lecturerProfileExists) {
          await supabase.auth.signOut();
          clearAuthRole();
          navigate("/teacher-login", {
            replace: true,
            state: { error: "Lecturer accounts must use Teacher Login." },
          });
          return;
        }
      } catch {
        // Ignore network hiccups and continue with standard student path.
      }

      // Set role first so App auth-state listener does not reject the fresh session.
      setAuthRole(AUTH_ROLES.STUDENT);

      try {
        await syncAuthenticatedUser("STUDENT", session?.access_token);
      } catch (syncError) {
        await supabase.auth.signOut();
        clearAuthRole();
        navigate("/login", {
          replace: true,
          state: { error: syncError.message || "Unable to initialize user session." },
        });
        return;
      }

      navigate("/student", { replace: true });
    };

    finishOAuthSignIn();
  }, [navigate]);

  return (
    <BaseLayout headerTitle="Attendance" maxWidth="420px">
      <h2
        style={{
          marginBottom: "12px",
          fontSize: "clamp(22px, 4vw, 28px)",
          color: "#111827",
          fontWeight: 800,
          textAlign: "center",
        }}
      >
        Signing You In
      </h2>

      <p
        style={{
          marginBottom: "18px",
          color: "#555",
          fontSize: "clamp(14px, 2.5vw, 16px)",
          textAlign: "center",
        }}
      >
        {statusMessage}
      </p>

      <button
        onClick={() => navigate("/login")}
        style={responsiveButtonStyle("#10316b", "white")}
      >
        Back To Login
      </button>
    </BaseLayout>
  );
}
