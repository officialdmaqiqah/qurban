const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentTrx() {
    const { data } = await supabase.from('transaksi').select('*').order('created_at', { ascending: false }).limit(3);
    console.log('Recent Transactions:', JSON.stringify(data, null, 2));
}

checkRecentTrx();
