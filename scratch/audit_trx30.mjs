import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseFile = fs.readFileSync('src/supabase.js', 'utf8');
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.*?)['"]/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find Supabase URL or Key in src/supabase.js");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function audit() {
    console.log("=== AUDIT TRX00030 ===");
    try {
        const { data: trx, error: trxErr } = await supabase.from('transaksi').select('*').eq('id', 'TRX00030').maybeSingle();
        if (trxErr) console.error("TRX Error:", trxErr);
        console.log("TRX Data:", JSON.stringify(trx, null, 2));

        console.log("\n=== MENCARI DATA KEUANGAN TERKAIT ===");
        const { data: fins, error: finErr } = await supabase.from('keuangan').select('*').or(`keterangan.ilike.%TRX00030%,id.ilike.%ADJ-786074%,id.ilike.%ADJ-788074%`);
        if (finErr) console.error("Fin Error:", finErr);
        console.log("Finance Records Found:", JSON.stringify(fins, null, 2));

        if (fins && fins.length > 0) {
            console.log("\n=== SIMULASI PERHITUNGAN ===");
            let total = 0;
            fins.forEach(f => {
                let nom = parseFloat(String(f.nominal).replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;
                const isAdj = f.id.startsWith('ADJ-') || (f.kategori || '').toLowerCase().includes('internal');
                const isIncome = f.tipe === 'pemasukan';
                
                let val = 0;
                if (isIncome) val = nom;
                else if (isAdj) val = Math.abs(nom);
                else val = -Math.abs(nom);

                total += val;
                console.log(`Record ${f.id}: Raw=${f.nominal}, Parsed=${nom}, Contribution=${val}, CurrentTotal=${total}`);
            });
            console.log("\nFinal Calculated Total:", total);
            if (trx) {
                console.log("Goal (Total Deal):", trx.total_deal);
                console.log("Status Lunas:", total >= trx.total_deal ? "YA" : "TIDAK");
            }
        } else {
            console.log("Tidak ada data keuangan yang cocok.");
        }
    } catch (e) {
        console.error("Global Error:", e);
    }
}

audit();
