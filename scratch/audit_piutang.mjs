import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditPiutang() {
    console.log('--- Audit Piutang Penjualan (Musim 2026) ---');
    
    const today = new Date();
    const startSeason = new Date(today.getFullYear(), 0, 1);
    const endSeason = new Date(today.getFullYear(), 11, 31, 23, 59, 59);

    const { data: trxs, error } = await supabase.from('transaksi').select('*');
    if (error) {
        console.error(error);
        return;
    }

    let totalOmzet = 0;
    let totalPaidInTrx = 0;
    let count = 0;

    trxs.forEach(t => {
        const dt = new Date(t.tgl_trx || t.tglTrx);
        if (dt < startSeason || dt > endSeason) return;

        count++;
        let deal = (parseFloat(t.total_deal || t.totalDeal) || 0);
        if(t.added_cost) deal += parseFloat(t.added_cost);
        if(t.admin_fee) deal += parseFloat(t.admin_fee);
        
        totalOmzet += deal;
        totalPaidInTrx += (parseFloat(t.total_paid || t.totalPaid) || 0);
    });

    console.log(`Jumlah Transaksi: ${count}`);
    console.log(`Total Omzet: Rp ${totalOmzet.toLocaleString('id-ID')}`);
    console.log(`Total Terbayar (Table Transaksi): Rp ${totalPaidInTrx.toLocaleString('id-ID')}`);
    console.log(`Sisa Piutang: Rp ${(totalOmzet - totalPaidInTrx).toLocaleString('id-ID')}`);
    
    console.log('\n--- Cek Pembayaran di Tabel Keuangan ---');
    const { data: fin } = await supabase.from('keuangan').select('*').eq('tipe', 'pemasukan');
    let totalCashIn = 0;
    fin.forEach(f => {
        const dt = new Date(f.tanggal);
        if (dt < startSeason || dt > endSeason) return;
        totalCashIn += (parseFloat(f.nominal) || 0);
    });
    console.log(`Total Pemasukan Kas (Seasonal): Rp ${totalCashIn.toLocaleString('id-ID')}`);
}

auditPiutang();
