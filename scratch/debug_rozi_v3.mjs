import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log('Searching for "Aqiqah" in Keuangan...');
    const { data: fin } = await supabase.from('keuangan').select('*').order('created_at', { ascending: false }).limit(100);
    const matches = fin.filter(f => JSON.stringify(f).toLowerCase().includes('aqiqah') || JSON.stringify(f).toLowerCase().includes('rozi'));
    console.log('Matches:', matches.map(m => ({ id: m.id, date: m.tanggal, desc: m.deskripsi || m.keterangan, amount: m.nominal, channel: m.channel })));

    console.log('\nSearching for 1,500,000 in Keuangan...');
    const amountMatches = fin.filter(f => Math.abs(f.nominal) === 1500000);
    console.log('Amount matches:', amountMatches.map(m => ({ id: m.id, date: m.tanggal, desc: m.deskripsi || m.keterangan, amount: m.nominal, channel: m.channel })));
}

debug();
