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
        
        // --- REDUNDANT SAFETY REDIRECT ---
        if (!isAdmin) {
            window.location.href = 'kambing.html';
            return;
        }

        const permissions = profile.permissions || {};
        const linkedAgen = profile.linked_agen_nama || permissions.linkedAgen || '';
        const agenLinkedId = profile.linked_agen_id || permissions.linkedAgenId || '';

        let trxDb = trxDbAll || [];
        const isStrict = permissions.strictAgen;

        // Filter by Agency if needed
        console.log("[Dashboard Debug] Profile:", profile);
        console.log("[Dashboard Debug] LinkedAgen:", linkedAgen);
        
        if (!isAdmin || isStrict) {
            const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            if (linkedAgen) {
                const search = clean(linkedAgen);
                const beforeCount = trxDb.length;
                trxDb = trxDb.filter(t => {
                    if (!t.agen) return false;
                    const name = clean(typeof t.agen === 'string' ? t.agen : (t.agen.nama || ''));
                    const id = clean(t.agen.id || '');
                    return name === search || id === search || name.includes(search) || search.includes(name);
                });
                console.log(`[Dashboard Debug] Filtered from ${beforeCount} to ${trxDb.length} rows using search: "${search}"`);
            } else if (userRole === 'agen') {
                 console.log("[Dashboard Debug] Role Agen but no linkedAgen - clearing data");
                 trxDb = [];
            }
        }

        // 1. KAS & LIKUIDITAS
        let totalSaldoKasBank = (keuanganDb || []).reduce((acc, item) => {
            const ch = (item.channel || 'Tunai').toLowerCase();
            if (ch.includes('non-kas')) return acc;
            const nom = parseFloat(item.nominal) || 0;
            return acc + (item.tipe === 'pemasukan' ? nom : -nom);
        }, 0);

        // 1.1 HUTANG & TITIPAN
        let totalHutangKomisi = 0;
        let totalTitipanAgen = 0;

        trxDb.forEach(t => {
            if(t.komisi && t.komisi.status === 'belum_bayar' && t.komisi.berhak === true) {
                totalHutangKomisi += (parseFloat(t.komisi.nominal) || 0);
            }
        });

        (keuanganDb || []).forEach(f => {
            const kat = (f.kategori || '').toLowerCase();
            const nom = parseFloat(f.nominal) || 0;
            if (kat.includes('titipan dana agen')) {
                totalTitipanAgen += (f.tipe === 'pemasukan' ? nom : -nom);
            } else if (kat.includes('pemakaian titipan') || kat.includes('penarikan titipan')) {
                // Pemakaian biasanya dicatat sebagai pengeluaran (tipe='pengeluaran')
                if (f.tipe === 'pengeluaran') totalTitipanAgen -= nom;
                else if (f.tipe === 'pemasukan') totalTitipanAgen += nom; // Fallback jika salah input tipe
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

        // 3. DASHBOARD FILTER PERIODE (MUSIM BERJALAN)
        const today = new Date();
        const startSeason = new Date(today.getFullYear(), 0, 1);
        const endSeason = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
        const seasonYear = today.getFullYear();

        // Update UI Labels
        const elLabelPerforma = document.querySelector('h3[style*="margin-top: 2rem"]');
        if(elLabelPerforma) elLabelPerforma.innerHTML = `📈 Performa & Profitabilitas <span style="font-size:0.75rem; background:var(--primary-transparent); color:var(--primary); padding:2px 10px; border-radius:30px; margin-left:10px; border:1px solid var(--primary);">Musim ${seasonYear}</span>`;

        // 3. CASH FLOW (SEASONAL)
        let totalPemasukan = 0;
        let totalPengeluaran = 0;
        (keuanganDb || []).forEach(item => {
            const dt = new Date(item.tanggal);
            if (dt < startSeason || dt > endSeason) return;

            if(!(item.channel || '').toLowerCase().includes('non-kas')) {
                if (item.tipe === 'pemasukan') totalPemasukan += (parseFloat(item.nominal) || 0);
                if (item.tipe === 'pengeluaran') totalPengeluaran += (parseFloat(item.nominal) || 0);
            }
        });

        // 4. PROFIT & PIUTANG CALCULATION (SEASONAL - SYNCED WITH REPORT LOGIC)
        const parseNum = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            return parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
        };

        let omzet = 0, hpp = 0, komisi = 0, saving = 0, totalPaidFinance = 0;
        
        // 4.1 PENJUALAN & HPP
        (trxDbAll || []).forEach(t => {
            const dt = new Date(t.tgl_trx || t.tglTrx);
            if (dt < startSeason || dt > endSeason) return;

            // Omzet (Deal + Added Cost + Admin Fee)
            omzet += parseNum(t.total_deal || t.totalDeal);
            if(t.added_cost) omzet += parseNum(t.added_cost);
            if(t.admin_fee) omzet += parseNum(t.admin_fee);

            // HPP & Saving per Item
            if(t.items) {
                t.items.forEach(item => {
                    const g = goatsDb.find(x => x.id === item.goatId);
                    hpp += parseNum(g?.harga_nota);
                    saving += parseNum(g?.saving);
                });
            }

            // Komisi
            komisi += parseNum(t.komisi?.nominal);
        });

        // 4.2 BIAYA & PEMBAYARAN (KEUANGAN)
        let operatingExpenses = 0;
        let deadLossRaw = 0;
        let deadKomp = 0;
        let totalPaidInFinance = 0;

        // Identifikasi ID Transaksi Musim Ini untuk sinkronisasi Piutang
        const seasonTrxIds = (trxDbAll || [])
            .filter(t => {
                const dtTrx = new Date(t.tgl_trx || t.tglTrx);
                return dtTrx >= startSeason && dtTrx <= endSeason;
            })
            .map(t => t.id);

        (keuanganDb || []).forEach(f => {
            const dt = new Date(f.tanggal);
            const isInSeason = dt >= startSeason && dt <= endSeason;
            const katLine = (f.kategori || '').toLowerCase().trim();
            const nom = parseNum(f.nominal);

            if ((f.channel || '').toLowerCase().includes('non-kas')) {
                // Logika Non-Kas (Rugi Mati) - Hanya jika terjadi di musim ini
                if (isInSeason) {
                    if (f.tipe === 'pengeluaran') deadLossRaw += nom;
                    else if (f.tipe === 'pemasukan') deadKomp += nom;
                }
            } else {
                // Logika Kas/Bank Real
                if (f.tipe === 'pengeluaran') {
                    if (isInSeason) {
                        // SINKRONISASI KATEGORI (Case-Insensitive)
                        const isPurchasing = katLine.includes('bayar supplier') || katLine.includes('pelunasan supplier') || katLine.includes('beli kambing');
                        const isExclusion = isPurchasing || katLine.includes('komisi') || katLine.includes('bagi hasil') || katLine.includes('mutasi') || katLine.includes('titipan');
                        
                        if (!isExclusion) {
                            operatingExpenses += nom;
                        }
                    }
                } else if (f.tipe === 'pemasukan') {
                    // SINKRONISASI PEMBAYARAN (Piutang)
                    const isSalesPayment = katLine.includes('jual') || katLine.includes('lunas') || katLine.includes('dp') || katLine.includes('order');
                    
                    if (isSalesPayment) {
                        // Jika pembayaran terhubung ke Transaksi Musim Ini, hitung (abaikan tanggal bayar, misal DP 2025 untuk 2026)
                        if (f.related_trx_id && seasonTrxIds.includes(f.related_trx_id)) {
                            totalPaidInFinance += nom;
                        } 
                        // Jika tidak terhubung tapi terjadi di Musim Ini, hitung sebagai fallback
                        else if (isInSeason) {
                            totalPaidInFinance += nom;
                        }
                    }

                    // Kompensasi Supplier (Hanya jika di musim ini)
                    if (isInSeason && katLine.includes('kompensasi')) {
                        deadKomp += nom;
                    }
                }
            }
        });

        const netProfit = omzet - hpp - komisi - operatingExpenses - (deadLossRaw - deadKomp) - saving;
        const piutang = omzet - totalPaidInFinance;
        const totalProfitSales = omzet - hpp - komisi - saving;
        const unitsSold = countTerjual + countDistribusi;
        const avgProfit = unitsSold > 0 ? (totalProfitSales / unitsSold) : 0;
        const deadLossNet = deadLossRaw - deadKomp;
        const netProfitPerEkor = unitsSold > 0 ? (netProfit / unitsSold) : 0;

        // Update DOM
        // 1. Inventori Statement
        const totalPop = (goatsDb || []).length;
        document.getElementById('dashTotalKambing').textContent = totalPop;
        document.getElementById('dashTersedia').textContent = countTersedia;
        document.getElementById('dashTerjual').textContent = unitsSold;
        document.getElementById('dashSakitMatiCount').textContent = (countSakit + countMati);
        document.getElementById('dashHilang').textContent = countHilang;

        // --- COMPOSITION BAR LOGIC ---
        const updateBar = (id, count) => {
            const el = document.getElementById(id);
            if(el) {
                const pct = totalPop > 0 ? (count / totalPop * 100) : 0;
                el.style.width = pct + '%';
            }
        };
        updateBar('barAvailable', countTersedia);
        updateBar('barSold', unitsSold);
        updateBar('barSick', (countSakit + countMati));
        updateBar('barLost', countHilang);

        // 2. Performa Sales Statement
        document.getElementById('dashTerjualRp').textContent = formatRp(omzet);
        
        const elTerbayar = document.getElementById('dashTerbayarInfo');
        if(elTerbayar) elTerbayar.textContent = formatRp(totalPaidInFinance);
        
        const elPiutang = document.getElementById('dashPiutangInfo');
        if(elPiutang) elPiutang.textContent = formatRp(piutang);

        document.getElementById('dashTerjualEkor').textContent = `${unitsSold} Ekor Terjual`;
        document.getElementById('dashTotalHPP').textContent = formatRp(hpp);
        document.getElementById('dashTotalKomisiSales').textContent = formatRp(komisi);
        document.getElementById('dashTotalSavingSales').textContent = formatRp(saving);
        
        const elProfitSales = document.getElementById('dashProfitSales');
        if (elProfitSales) {
            elProfitSales.textContent = formatRp(totalProfitSales);
            elProfitSales.classList.remove('highlight-green', 'highlight-rose');
            elProfitSales.classList.add(totalProfitSales >= 0 ? 'highlight-green' : 'highlight-rose');
        }
        document.getElementById('dashAvgProfit').textContent = formatRp(avgProfit);

        // 3. Profitabilitas Statement
        const elNet = document.getElementById('dashProfitRealtime');
        if (elNet) {
            elNet.textContent = (netProfit >= 0 ? '+' : '') + formatRp(netProfit);
            elNet.classList.remove('highlight-green', 'highlight-rose');
            elNet.classList.add(netProfit >= 0 ? 'highlight-green' : 'highlight-rose');
        }
        document.getElementById('dashOperatingExpenses').textContent = formatRp(operatingExpenses);
        document.getElementById('dashKerugianMati').textContent = formatRp(deadLossNet);
        document.getElementById('dashNetProfitPerEkor').textContent = formatRp(netProfitPerEkor);

        // 4. Kas & Likuiditas Statement
        document.getElementById('dashTotalSaldoKas').textContent = formatRp(totalSaldoKasBank);
        document.getElementById('dashTotalTitipan').textContent = formatRp(totalTitipanAgen);

        // --- CASH BREAKDOWN INJECTION ---
        const channelBalances = {};
        (keuanganDb || []).forEach(f => {
            const ch = (f.channel || 'Tunai').trim();
            if (ch.toLowerCase().includes('non-kas')) return;
            const nom = parseNum(f.nominal);
            channelBalances[ch] = (channelBalances[ch] || 0) + (f.tipe === 'pemasukan' ? nom : -nom);
        });

        const breakdownContainer = document.getElementById('cashBreakdownContainer');
        if (breakdownContainer) {
            breakdownContainer.innerHTML = '';
            // Sort to prioritize requested channels
            const preferred = ['Kas Operasional', 'Tunai', 'Mandiri', 'BSI'];
            const sortedChannels = Object.keys(channelBalances).sort((a, b) => {
                const idxA = preferred.findIndex(p => a.toLowerCase().includes(p.toLowerCase()));
                const idxB = preferred.findIndex(p => b.toLowerCase().includes(p.toLowerCase()));
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            sortedChannels.forEach(ch => {
                const bal = channelBalances[ch];
                if (Math.abs(bal) < 1) return; // Skip zero balances
                const item = document.createElement('div');
                item.className = 'data-row';
                item.innerHTML = `
                    <span class="data-label">${ch}</span>
                    <span class="data-value">${formatRp(bal)}</span>
                `;
                breakdownContainer.appendChild(item);
            });
        }

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
        const agens = (await supabase.from('master_data').select('val').eq('key', 'AGENS').single()).data?.val || [];
        const linkedAgenData = agens.find(a => a.nama === linkedAgen);
        const linkedType = (linkedAgenData?.jenis || '').toUpperCase();
        
        const isMK = isAdmin || linkedType.includes('MARKETING KANDANG');
        if (!isMK) {
            const banner = document.querySelector('div[onclick*="laporan.html"]');
            if (banner) banner.style.display = 'none';
        }

        // --- AFFILIATE LINK LOGIC ---
        const isMarketing = ['marketing_dm', 'marketing_ext', 'marketing_kandang', 'reseller'].includes(userRole);
        const isAgen = userRole === 'agen' || !!linkedAgen || isMarketing;
        const affiliateCard = document.getElementById('affiliateCard');
        if (isAgen && affiliateCard) {
            affiliateCard.style.display = 'block';
            const username = (profile.email || '').split('@')[0];
            const baseUrl = 'dmqurban.com/etalase.html';
            const fullLink = `${baseUrl}?ref=${username}`;
            
            const linkText = document.getElementById('affiliateLinkText');
            if (linkText) linkText.textContent = fullLink;
            
            const copyBtn = document.getElementById('copyAffiliateBtn');
            if (copyBtn) {
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText('https://' + fullLink);
                    copyBtn.textContent = '✅ Tersalin!';
                    setTimeout(() => { copyBtn.textContent = 'Salin Link'; }, 2000);
                };
            }
        }
    };

    // Initial Load
    updateDashboard();

    // Auto Refresh every 5 minutes
    setInterval(updateDashboard, 5 * 60 * 1000);
});
