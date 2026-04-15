import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMissingOpex() {
    const start = new Date('2026-01-01T00:00:00');
    const end = new Date('2026-12-31T23:59:59');

    const { data: fin, error } = await supabase.from('keuangan').select('*');
    if (error) { console.error(error); return; }

    const channels = {};

    fin.forEach(f => {
        const dt = new Date(f.tanggal);
        if (dt < start || dt > end) return;
        
        const chan = f.channel || 'Tunai';
        const nom = parseFloat(f.nominal || 0);
        const kat = (f.kategori || '').toLowerCase();
        
        if (f.tipe === 'pengeluaran') {
             if (kat !== 'bayar supplier' && kat !== 'pelunasan supplier' && kat !== 'kerugian (mati/hilang)') {
                 if (!channels[chan]) channels[chan] = 0;
                 channels[chan] += nom;
             }
        }
    });

    console.log('--- BREAKDOWN OPE PER CHANNEL 2026 ---');
    Object.keys(channels).forEach(c => {
        console.log(`${c}: Rp ${channels[c].toLocaleString('id-ID')}`);
    });
}

findMissingOpex();
