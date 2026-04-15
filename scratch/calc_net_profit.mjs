import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function calculateDetail() {
    console.log('--- Memulai Audit Laba Bersih Aktual ---');

    const [
        { data: trxs },
        { data: goats },
        { data: keuangan }
    ] = await Promise.all([
        supabase.from('transaksi').select('*'),
        supabase.from('stok_kambing').select('*'),
        supabase.from('keuangan').select('*')
    ]);

    // 1. HITUNG LABA KOTOR PENJUALAN
    let totalDeal = 0;
    let totalHppSold = 0;
    let totalSaving = 0;
    let totalKomisi = 0;

    (trxs || []).forEach(t => {
        (t.items || []).forEach(item => {
            const g = (goats || []).find(x => x.id === item.goatId);
            totalDeal += (parseFloat(item.hargaDeal) || 0);
            totalHppSold += (parseFloat(g?.harga_nota) || 0);
            totalSaving += (parseFloat(g?.saving) || 0);
        });
        totalKomisi += (parseFloat(t.komisi?.nominal) || 0);
    });

    const grossProfit = totalDeal - totalHppSold - totalSaving - totalKomisi;

    console.log(`1. PENJUALAN`);
    console.log(`   + Total Nilai Deal: Rp ${totalDeal.toLocaleString('id-ID')}`);
    console.log(`   - Total Modal (HPP): Rp ${totalHppSold.toLocaleString('id-ID')}`);
    console.log(`   - Total Dana Saving (Titipan): Rp ${totalSaving.toLocaleString('id-ID')}`);
    console.log(`   - Total Komisi Agen: Rp ${totalKomisi.toLocaleString('id-ID')}`);
    console.log(`   = LABA KOTOR PENJUALAN: Rp ${grossProfit.toLocaleString('id-ID')}`);

    // 2. HITUNG BIAYA OPERASIONAL (CASH CHANNELS)
    let opexReal = 0;
    const opexDetails = {};

    (keuangan || []).forEach(f => {
        const chan = (f.channel || '').toLowerCase();
        const kat = (f.kategori || '').toLowerCase();
        
        if (!chan.includes('non-kas')) {
            if (f.tipe === 'pengeluaran' && !kat.includes('beli kambing') && !kat.includes('pelunasan supplier')) {
                opexReal += (parseFloat(f.nominal) || 0);
                opexDetails[f.kategori] = (opexDetails[f.kategori] || 0) + (parseFloat(f.nominal) || 0);
            }
        }
    });

    console.log(`\n2. BIAYA OPERASIONAL (Kas/Bank)`);
    Object.keys(opexDetails).forEach(k => {
        console.log(`   - ${k}: Rp ${opexDetails[k].toLocaleString('id-ID')}`);
    });
    console.log(`   = TOTAL BEBAN OPERASIONAL: Rp ${opexReal.toLocaleString('id-ID')}`);

    // 3. KERUGIAN KEMATIAN (NON-KAS CHANNELS)
    let lossMati = 0;
    (keuangan || []).forEach(f => {
        const chan = (f.channel || '').toLowerCase();
        if (chan.includes('non-kas')) {
            const nom = (parseFloat(f.nominal) || 0);
            if (f.tipe === 'pengeluaran') lossMati += nom;
            else lossMati -= nom; // Kompensasi supplier di channel non-kas jika ada
        }
    });

    console.log(`\n3. KERUGIAN LAIN (Mati/Hilang)`);
    console.log(`   - Total Kerugian Non-Kas: Rp ${lossMati.toLocaleString('id-ID')}`);

    // 4. HASIL AKHIR
    const netProfit = grossProfit - opexReal - lossMati;
    console.log(`\n--- PERHITUNGAN AKHIR ---`);
    console.log(`   Laba Kotor: Rp ${grossProfit.toLocaleString('id-ID')}`);
    console.log(`   Beban Ops : Rp ${opexReal.toLocaleString('id-ID')}`);
    console.log(`   Rugi Mati : Rp ${lossMati.toLocaleString('id-ID')}`);
    console.log(`   ---------------------------`);
    console.log(`   LABA BERSIH AKTUAL: Rp ${netProfit.toLocaleString('id-ID')}`);
}

calculateDetail();
