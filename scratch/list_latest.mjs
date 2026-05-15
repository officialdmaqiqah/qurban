import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listLatest() {
    const { data: trxs } = await supabase.from('transaksi').select('id, customer_name, total_paid, total_deal, created_at').order('created_at', { ascending: false }).limit(10);
    console.log("Latest Trxs:", trxs);

    const { data: fins } = await supabase.from('keuangan').select('*').order('tanggal', { ascending: false }).limit(10);
    console.log("Latest Keuangan:", fins);
}

listLatest();
