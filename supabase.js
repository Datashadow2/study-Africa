import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🔑 Replace these with your real Supabase project values
const SUPABASE_URL = "https://umpfhkvdkaufhtmmgxxg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcGZoa3Zka2F1Zmh0bW1neHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjk4MzMsImV4cCI6MjA5MzY0NTgzM30.zAiHoJLm9w9cmE6iHaLI9quvQw1zZOgV800yHZIIMwo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
