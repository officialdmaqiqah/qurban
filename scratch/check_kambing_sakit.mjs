import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkKambingSakit() {
    const { data, error } = await supabase
        .from('stok_kambing')
        .select('id, no_tali, status_kesehatan, updated_at')
        .neq('status_kesehatan', 'Sehat');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Total non-Sehat goats:', data.length);
    console.log('Sample data:', data.slice(0, 10));
    
    const counts = {};
    data.forEach(item => {
        counts[item.status_kesehatan] = (counts[item.status_kesehatan] || 0) + 1;
    });
    console.log('Status counts:', counts);
}

checkKambingSakit();
