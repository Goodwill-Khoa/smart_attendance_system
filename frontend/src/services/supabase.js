import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://weiwqxlagctwyxiygdfu.supabase.co"; //test
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlaXdxeGxhZ2N0d3l4aXlnZGZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTcxMDYsImV4cCI6MjA5MTY3MzEwNn0.lw9pho87kPTQTiMXk5pAGNTroTQEIyqNLyF26QiW7aY";   //test
console.log("URL:", supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);