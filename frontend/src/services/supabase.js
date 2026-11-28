import { createClient } from "@supabase/supabase-js";
import { getApiBaseUrl } from "./apiBase";

const fallbackSupabaseUrl = "https://vygiutowqdzxuqagnidj.supabase.co";
const fallbackSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z2l1dG93cWR6eHVxYWduaWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA1NDQsImV4cCI6MjA5Mjc5NjU0NH0.pm4t5QfH0ayYrrUjIR4XGcpmqPbCoXe--mLWRToy7RA";

export const isLocalDemoAuth = import.meta.env.VITE_LOCAL_DEMO_AUTH === "true";

const LOCAL_SESSION_KEY = "smart_attendance_local_session";
const LOCAL_ROLE_KEY = "smart_attendance_role";

function createLocalDemoClient() {
	const listeners = new Set();
	const notify = (event, session) => {
		listeners.forEach((listener) => listener(event, session));
	};

	const getSession = async () => {
		try {
			const session = JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY) || "null");
			if (session?.expires_at && session.expires_at <= Date.now() / 1000) {
				localStorage.removeItem(LOCAL_SESSION_KEY);
				return { data: { session: null }, error: null };
			}
			return { data: { session }, error: null };
		} catch (error) {
			return { data: { session: null }, error };
		}
	};

	return {
		auth: {
			getSession,
			onAuthStateChange(callback) {
				listeners.add(callback);
				getSession().then(({ data }) => callback("INITIAL_SESSION", data.session));
				return {
					data: {
						subscription: { unsubscribe: () => listeners.delete(callback) },
					},
				};
			},
			async signInWithPassword({ email, password }) {
				try {
					const role = localStorage.getItem(LOCAL_ROLE_KEY);
					const loginRole = role === "admin" ? "SUPERUSER" : role?.toUpperCase();
					const response = await fetch(`${getApiBaseUrl()}/auth/local-demo-login`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ username: email, password, role: loginRole }),
					});
					const payload = await response.json().catch(() => ({}));
					if (!response.ok) {
						return {
							data: { user: null, session: null },
							error: new Error(payload.detail || "Local demo sign-in failed."),
						};
					}

					const session = {
						access_token: payload.access_token,
						token_type: payload.token_type,
						expires_in: payload.expires_in,
						expires_at: Math.floor(Date.now() / 1000) + payload.expires_in,
						user: payload.user,
					};
					localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
					notify("SIGNED_IN", session);
					return { data: { user: session.user, session }, error: null };
				} catch (error) {
					return { data: { user: null, session: null }, error };
				}
			},
			async signOut() {
				localStorage.removeItem(LOCAL_SESSION_KEY);
				notify("SIGNED_OUT", null);
				return { error: null };
			},
			async signInWithOAuth() {
				return { data: null, error: new Error("OAuth is unavailable in local demo mode.") };
			},
			async exchangeCodeForSession() {
				return { data: null, error: new Error("OAuth callbacks are unavailable in local demo mode.") };
			},
			async updateUser() {
				return { data: { user: null }, error: new Error("Password changes are unavailable in local demo mode.") };
			},
			async getUser() {
				const { data } = await getSession();
				return { data: { user: data.session?.user || null }, error: null };
			},
		},
	};
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl).trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey).trim();

if (!isLocalDemoAuth && (!supabaseUrl || !supabaseAnonKey)) {
	throw new Error(
		"Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment variables."
	);
}

export const supabase = isLocalDemoAuth
	? createLocalDemoClient()
	: createClient(supabaseUrl, supabaseAnonKey);