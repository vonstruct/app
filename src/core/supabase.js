import { createClient } from '@supabase/supabase-js';
// Publieke (publishable) sleutel: zonder login kan die niets lezen of wijzigen.
// Alle gegevens zitten achter de login + rijbeveiliging (is_app_user) in Supabase.
export const SUPABASE_URL = 'https://ovogwibcneioclpzhyqf.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_65zfvoGs_-NdGqz5LCfwTg_02vSdeV-';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
});
