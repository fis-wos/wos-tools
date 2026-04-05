import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aqlpjruljljtuztyogxh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_W6H1oH-0d9fHiXAq6VKM6w_e5h1A7Lx';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
