import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkData() {
    console.log('--- Checking Rekening ---');
    const { data: rek } = await supabase.from('master_data').select('*').eq('key', 'REKENING').single();
    console.log('REKENING:', JSON.stringify(rek?.val, null, 2));

    const { data: oldRek } = await supabase.from('master_data').select('*').eq('key', 'BANK_ACCOUNTS').single();
    console.log('BANK_ACCOUNTS:', JSON.stringify(oldRek?.val, null, 2));

    console.log('\n--- Checking Agens ---');
    const { data: agens } = await supabase.from('master_data').select('*').eq('key', 'AGENS').single();
    console.log('AGENS count:', agens?.val?.length || 0);
    if (agens?.val) {
        console.log('First 2 agens:', JSON.stringify(agens.val.slice(0, 2), null, 2));
    }

    console.log('\n--- Checking a Sample Goat Photo ---');
    const { data: goats } = await supabase.from('stok_kambing').select('id, no_tali, foto_fisik').not('foto_fisik', 'is', null).limit(3);
    console.log('Sample Goats with photos:', JSON.stringify(goats, null, 2));
}

checkData();
