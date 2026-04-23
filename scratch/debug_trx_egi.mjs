import { supabase } from '../src/supabase.js';

async function debug() {
    const { data, error } = await supabase.from('transaksi').select('*').eq('id', 'TRX00011').single();
    if (error) {
        console.error("Error fetching TRX00011:", error);
        return;
    }
    console.log("TRX00011 Data:");
    console.log(JSON.stringify(data, null, 2));
}

debug();
