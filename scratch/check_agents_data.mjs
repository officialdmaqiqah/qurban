import { createClient } from '@supabase/supabase-base';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkAgents() {
    const { data } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
    console.log('Agents Data:', JSON.stringify(data?.val, null, 2));
}

checkAgents();
