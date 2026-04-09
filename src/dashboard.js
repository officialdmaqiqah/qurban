import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if(email) document.getElementById('userEmailDisplay').textContent = email;

    const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);

    const updateDashboard = async () => {
        const [
            { data: goatsDb },
            { data: trxDbAll },
            { data: keuanganDb },
            reNew,
            reOld
        ] = await Promise.all([
            supabase.from('stok_kambing').select('*'),
            supabase.from('transaksi').select('*'),
            supabase.from('keuangan').select('*'),
            supabase.from('master_data').select('val').eq('key', 'REKENING').single(),
            supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single()
        ]);

        const reksData = (reNew?.data?.val && reNew.data.val.length > 0) ? reNew.data : (reOld?.data || null);
        const rekeningDb = reksData?.val || [];
        const userRole = (profile.role || 'staff').toLowerCase().trim();
        const isAdmin = ['admin', 'office', 'staf', 'operator'].includes(userRole);
        const permissions = profile.permissions || {};
        const agenLinkedId = profile.permissions?.linkedAgenId || '';

        let trxDb = trxDbAll || [];
        const isStrict = permissions.strictAgen;

        // Filter by Agency if needed
        if (!isAdmin || isStrict) {
            if (agenLinkedId) {
                trxDb = trxDb.filter(t => t.agen && t.agen.id === agenLinkedId);
            } else if (userRole === 'agen') {
                 trxDb = [];
            }
        }

        // 1. KAS & LIKUIDITAS
        const getSaldoChannel = (target) => {
            let s = 0;
            const targetClean = (target || '').toLowerCase().trim();
            (keuanganDb || []).forEach(item => {
                const ch = (item.channel || 'Tunai').toLowerCase().trim();
                const isMatch = (targetClean === 'tunai') ? (ch === 'tunai' || ch.includes('cash')) : (ch === targetClean || ch.includes(targetClean));
                if(isMatch) {
                    if(item.tipe === 'pemasukan') s += (parseFloat(item.nominal) || 0);
                    if(item.tipe === 'pengeluaran') s -= (parseFloat(item.nominal) || 0);
                }
            });
            return s;
        };

        let totalSaldoKasBank = getSaldoChannel('Tunai');
        rekeningDb.forEach(acc => {
            totalSaldoKasBank += getSaldoChannel(`${acc.bank} - ${acc.norek}`);
        });

        // 1.1 HUTANG KOMISI
        let totalHutangKomisi = 0;
        trxDb.forEach(t => {
            if(t.komisi && t.komisi.status === 'belum_bayar' && t.komisi.berhak === true) {
                totalHutangKomisi += (parseFloat(t.komisi.nominal) || 0);
            }
        });

        // 2. STOK STATS
        let nilaiAsetStok = 0;
        let countTersedia = 0, countTerjual = 0, countDistribusi = 0, countSakit = 0, countMati = 0, countHilang = 0;

        (goatsDb || []).forEach(k => {
            let isOwnGoat = true;
            if (isStrict && agenLinkedId) {
                isOwnGoat = (k.transaction_id && trxDb.some(t => t.id === k.transaction_id));
            }

            if (k.status_transaksi === 'Tersedia') {
                if (!isStrict) { 
                    countTersedia++;
                    nilaiAsetStok += (parseFloat(k.harga_nota) || 0);
                }
            } else if (k.status_transaksi === 'Terjual') {
                if (isOwnGoat) countTerjual++;
            } else if (k.status_transaksi === 'Terdistribusi') {
                if (isOwnGoat) countDistribusi++;
            }
            
            if (isOwnGoat) {
                if (k.status_kesehatan === 'Sakit') countSakit++;
                if (['Mati', 'Disembelih'].includes(k.status_kesehatan)) countMati++;
                if (k.status_fisik === 'Hilang') countHilang++;
            }
        });

        // 3. CASH FLOW
        let totalPemasukan = 0;
        let totalPengeluaran = 0;
        (keuanganDb || []).forEach(item => {
            if(!(item.channel || '').toLowerCase().includes('non-kas')) {
                if (item.tipe === 'pemasukan') totalPemasukan += (parseFloat(item.nominal) || 0);
                if (item.tipe === 'pengeluaran') totalPengeluaran += (parseFloat(item.nominal) || 0);
            }
        });

        // 4. PROFIT CALCULATION
        let grossProfitSales = 0;
        trxDb.forEach(t => {
            if(t.items) {
                t.items.forEach(item => {
                    const k = goatsDb.find(g => g.id === item.goatId);
                    const nota = k ? (parseFloat(k.harga_nota) || 0) : 0;
                    const saving = k ? (parseFloat(k.saving) || 0) : 0;
                    grossProfitSales += ((parseFloat(item.hargaDeal) || 0) - nota - saving);
                });
            }
            grossProfitSales -= (t.komisi ? (parseFloat(t.komisi.nominal) || 0) : 0);
        });

        let operatingExpenses = 0;
        let netLossKematian = 0;
        (keuanganDb || []).forEach(item => {
            const kat = (item.kategori || '').toLowerCase();
            if((item.channel || '').toLowerCase().includes('non-kas')) {
                if(item.tipe === 'pengeluaran') netLossKematian += (parseFloat(item.nominal) || 0);
                else if(item.tipe === 'pemasukan') netLossKematian -= (parseFloat(item.nominal) || 0);
            } else {
                if(item.tipe === 'pengeluaran' && !kat.includes('beli kambing') && !kat.includes('pelunasan supplier')) {
                    operatingExpenses += (parseFloat(item.nominal) || 0);
                }
            }
        });

        const netProfit = grossProfitSales - operatingExpenses - netLossKematian;

        // Update DOM
        document.getElementById('dashTotalSaldoKas').textContent = formatRp(totalSaldoKasBank);
        document.getElementById('dashHutangAgen').textContent = formatRp(totalHutangKomisi);
        document.getElementById('dashSaldoNetto').textContent = formatRp(totalSaldoKasBank - totalHutangKomisi);
        document.getElementById('dashNilaiAsetStok').textContent = formatRp(nilaiAsetStok);
        document.getElementById('dashPemasukan').textContent = formatRp(totalPemasukan);
        document.getElementById('dashPengeluaran').textContent = formatRp(totalPengeluaran);
        
        const elNet = document.getElementById('dashProfitRealtime');
        if(elNet) {
            elNet.textContent = (netProfit >= 0 ? '+' : '') + formatRp(netProfit);
            elNet.style.color = netProfit < 0 ? 'var(--danger)' : 'var(--success)';
        }

        document.getElementById('dashTotalKambing').textContent = (userRole === 'agen' ? (countTerjual + countDistribusi) : (goatsDb || []).length) + ' Ekor';
        document.getElementById('dashTersedia').textContent = countTersedia;
        document.getElementById('dashTerjual').textContent = countTerjual;
        document.getElementById('dashDistribusi').textContent = countDistribusi;
        document.getElementById('dashSakitOnly').textContent = countSakit;
        document.getElementById('dashSakitMatiCount').textContent = countSakit + countMati;

        // Apply Permissions Hiding
        if (permissions.hideProfit) {
            const el = document.getElementById('dashProfitRealtime')?.closest('.card-box');
            if(el) el.style.display = 'none';
        }
        if (permissions.hideHargaNota) {
            const el = document.getElementById('dashNilaiAsetStok')?.closest('.card-box');
            if(el) el.style.display = 'none';
        }
        if (isStrict) {
            ['dashTotalSaldoKas', 'dashHutangAgen', 'dashSaldoNetto'].forEach(id => {
                const el = document.getElementById(id)?.closest('.card-box');
                if(el) el.style.display = 'none';
            });
        }

        // Hide Report Banner for non-admin/non-marketing kandang
        const isMK = userRole === 'admin' || (profile?.jenis_agen || '').toUpperCase().includes('MARKETING KANDANG');
        if (!isMK) {
            const banner = document.querySelector('div[onclick*="laporan.html"]');
            if (banner) banner.style.display = 'none';
        }
    };

    // Initial Load
    updateDashboard();

    // Auto Refresh every 5 minutes
    setInterval(updateDashboard, 5 * 60 * 1000);
});
