import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findDiscrepancy() {
    const { data: fin, error } = await supabase.from('keuangan').select('*');
    if (error) {
        console.error(error);
        return;
    }

    const parseNum = (val) => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
    };

    let opex_total = 0;
    let opex_kas_operasional = 0;
    let other_channels = [];

    fin.forEach(f => {
        const nom = parseNum(f.nominal);
        const katLine = (f.kategori || '').toLowerCase().trim();
        const chan = (f.channel || 'Tunai');
        const isNonKas = chan.toLowerCase().includes('non-kas');

        if (isNonKas) return;

        if (f.tipe === 'pengeluaran') {
            const isPurchasing = katLine.includes('bayar supplier') || katLine.includes('pelunasan supplier') || katLine.includes('beli kambing');
            const isExclusion = isPurchasing || katLine.includes('komisi') || katLine.includes('bagi hasil') || katLine.includes('mutasi') || katLine.includes('titipan');
            
            if (!isExclusion) {
                opex_total += nom;
                if (chan === 'Kas Operasional') {
                    opex_kas_operasional += nom;
                } else {
                    other_channels.push({ id: f.id, channel: chan, kategori: f.kategori, nominal: nom, catatan: f.catatan, tanggal: f.tanggal });
                }
            }
        }
    });

    console.log('Total Opex in Reports:', opex_total);
    console.log('Total Opex in Kas Operasional:', opex_kas_operasional);
    console.log('Discrepancy:', opex_total - opex_kas_operasional);
    console.log('\nExpenses from OTHER channels (included in opex):');
    console.log(other_channels);
}

findDiscrepancy();
