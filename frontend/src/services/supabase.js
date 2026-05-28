import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://vygiutowqdzxuqagnidj.supabase.co";
const fallbackSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Z2l1dG93cWR6eHVxYWduaWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA1NDQsImV4cCI6MjA5Mjc5NjU0NH0.pm4t5QfH0ayYrrUjIR4XGcpmqPbCoXe--mLWRToy7RA";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl).trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey).trim();

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error(
		"Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment variables."
	);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);