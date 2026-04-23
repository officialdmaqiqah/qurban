import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function calculateRealAvgProfit() {
    console.log('--- MENGHITUNG REAL AVG PROFIT / CLOSING (2026) ---');
    
    // 1. Load Data
    const { data: trxs, error: errTrx } = await supabase.from('transaksi').select('*');
    const { data: goats, error: errGoats } = await supabase.from('stok_kambing').select('*');

    if (errTrx || errGoats) {
        console.error('Error fetching data:', errTrx || errGoats);
        return;
    }

    // 2. Filter Periode (2026)
    const start = new Date('2026-01-01T00:00:00');
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const fTrxs = trxs.filter(t => {
        const d = new Date(t.tgl_trx || t.tglTrx);
        return d >= start && d <= end;
    });

    console.log(`Ditemukan ${fTrxs.length} transaksi di tahun 2026.`);

    // 3. Hitung Profit per Transaksi
    let totalProfit = 0;
    let detailResults = [];

    fTrxs.forEach(t => {
        const deal = t.total_deal || t.totalDeal || 0;
        
        // HPP dari item
        const hpp = (t.items || []).reduce((sh, it) => {
            const g = goats.find(x => x.id === it.goatId);
            return sh + (g?.harga_nota || 0);
        }, 0);

        const komisi = t.komisi?.nominal || 0;
        const profit = deal - hpp - komisi;

        totalProfit += profit;
        
        detailResults.push({
            id: t.id,
            customer: t.customer?.nama || 'N/A',
            deal,
            hpp,
            komisi,
            profit
        });
    });

    const avgProfit = fTrxs.length ? totalProfit / fTrxs.length : 0;

    console.log('\n--- RINGKASAN ---');
    console.log(`Total Transaksi: ${fTrxs.length}`);
    console.log(`Total Profit (Deal - HPP - Komisi): Rp ${totalProfit.toLocaleString('id-ID')}`);
    console.log(`Avg. Profit / Closing: Rp ${avgProfit.toLocaleString('id-ID')}`);
    
    console.log('\n--- 5 TRANSAKSI TERAKHIR ---');
    detailResults.sort((a,b) => b.id.localeCompare(a.id)).slice(0, 5).forEach(res => {
        console.log(`Trx: ${res.id} | Cust: ${res.customer} | Deal: ${res.deal.toLocaleString()} | HPP: ${res.hpp.toLocaleString()} | Komisi: ${res.komisi.toLocaleString()} | Profit: ${res.profit.toLocaleString()}`);
    });
}

calculateRealAvgProfit();
