import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function calculateSeason() {
    const startSeason = new Date('2026-01-01T00:00:00');
    const endSeason = new Date('2026-12-31T23:59:59');

    // 1. Get Transactions
    const { data: trxs, error: errTrx } = await supabase.from('transaksi').select('*');
    if (errTrx) { console.error(errTrx); return; }

    let totalOmzet = 0;
    let totalPaidInTrx = 0;
    const seasonTrxIds = [];

    trxs.forEach(t => {
        const dt = new Date(t.tgl_trx || t.tglTrx);
        if (dt >= startSeason && dt <= endSeason) {
            totalOmzet += (parseFloat(t.total_deal || t.totalDeal) || 0);
            if(t.added_cost) totalOmzet += parseFloat(t.added_cost);
            if(t.admin_fee) totalOmzet += parseFloat(t.admin_fee);
            
            totalPaidInTrx += (parseFloat(t.total_paid || t.totalPaid) || 0);
            seasonTrxIds.push(t.id);
        }
    });

    // 2. Get Keuangan
    const { data: fin, error: errFin } = await supabase.from('keuangan').select('*');
    if (errFin) { console.error(errFin); return; }

    let totalCashInSales = 0;
    let totalCashInAll = 0;

    fin.forEach(f => {
        const dt = new Date(f.tanggal);
        const nom = parseFloat(f.nominal) || 0;
        const kat = (f.kategori || '').toLowerCase();

        if (dt >= startSeason && dt <= endSeason) {
            if (f.tipe === 'pemasukan') {
                totalCashInAll += nom;
                
                // Flexible Match for Sales
                const isSales = kat.includes('jual') || kat.includes('lunas') || kat.includes('dp') || kat.includes('order');
                if (isSales && !kat.includes('kompensasi')) {
                    totalCashInSales += nom;
                }
            }
        } else if (f.related_trx_id && seasonTrxIds.includes(f.related_trx_id)) {
            // Include payments from before season for season orders
            if (f.tipe === 'pemasukan') {
                totalCashInSales += nom;
            }
        }
    });

    console.log('--- HASIL ANALISA DATABASE (MUSIM 2026) ---');
    console.log('1. TOTAL OMZET (Faktur): Rp', totalOmzet.toLocaleString('id-ID'));
    console.log('2. TOTAL PAID (Di Tabel Transaksi): Rp', totalPaidInTrx.toLocaleString('id-ID'));
    console.log('3. TOTAL PEMASUKAN SALES (Di Tabel Keuangan): Rp', totalCashInSales.toLocaleString('id-ID'));
    console.log('4. TOTAL CASH-IN SEMUA (Keuangan): Rp', totalCashInAll.toLocaleString('id-ID'));
    console.log('5. PIUTANG (Omzet - Pemasukan Sales): Rp', (totalOmzet - totalCashInSales).toLocaleString('id-ID'));
    console.log('6. PIUTANG (Omzet - Paid Trx): Rp', (totalOmzet - totalPaidInTrx).toLocaleString('id-ID'));
}

calculateSeason();
