import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gcbehtrvnkoxytdqpeyh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjYmVodHJ2bmtveHl0ZHFwZXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTY5NDEsImV4cCI6MjA5MzA3Mjk0MX0.6FcBfNF6ARW-FuBoN5JiMlRTxesXqX3YM3wWwCvUOe8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);