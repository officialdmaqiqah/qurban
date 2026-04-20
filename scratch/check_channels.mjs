import { createClient } from '@supabase/supabase-client-helpers';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkChannels() {
    const { data } = await supabase.from('keuangan').select('channel');
    const channels = [...new Set(data.map(d => d.channel))];
    console.log("Unique Channels:", channels);
}

checkChannels();
