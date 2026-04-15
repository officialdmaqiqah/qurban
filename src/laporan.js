import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if (email) document.getElementById('userEmailDisplay').textContent = email;

    const loggedUser = profile;
    const isAdmin = loggedUser.role === 'admin';

    const formatRp = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
    const formatDate = (dateString) => {
        if(!dateString) return '-';
        const d = new Date(dateString);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Tab Logic
    const tabItems = document.querySelectorAll('.tab-item');
    const sections = document.querySelectorAll('.report-section');
    tabItems.forEach(item => {
        item.onclick = () => {
            tabItems.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            const target = document.getElementById(item.dataset.target);
            if(target) target.classList.add('active');
        };
    });

    const loadData = async () => {
        const [
            { data: trxs },
            { data: goats },
            { data: fin },
            { data: config },
            { data: tripsData }
        ] = await Promise.all([
            supabase.from('transaksi').select('*'),
            supabase.from('stok_kambing').select('*'),
            supabase.from('keuangan').select('*'),
            supabase.from('master_data').select('val').eq('key', 'PORSI_BAGI_HASIL').single(),
            supabase.from('master_data').select('val').eq('key', 'TRIPS').single()
        ]);
        return { trxs: trxs || [], goats: goats || [], fin: fin || [], config: config?.val || { owner: 45, team: 55 }, trips: tripsData?.val || [] };
    };

    const renderDistribusi = (trips, start, end) => {
        const body = document.querySelector('#tableDist tbody');
        if(!body) return;
        body.innerHTML = '';

        const filtered = trips.filter(t => {
            const dt = new Date(t.tglKirim);
            return dt >= start && dt <= end;
        }).sort((a,b) => new Date(b.tglKirim) - new Date(a.tglKirim));

        if(filtered.length === 0) {
            body.innerHTML = '<tr><td colspan="7" align="center">Tidak ada data distribusi pada periode ini.</td></tr>';
            return;
        }

        filtered.forEach(t => {
            t.items.forEach((it, idx) => {
                const tr = document.createElement('tr');
                const statusColor = it.status === 'Terdistribusi' ? 'var(--success)' : 'var(--warning)';
                tr.innerHTML = `
                    <td style="font-weight:600">${idx === 0 ? t.id : ''}</td>
                    <td>${idx === 0 ? formatDate(t.tglKirim) : ''}</td>
                    <td>${idx === 0 ? `<strong>${t.sopirNama}</strong><br><small>${t.nopol || ''}</small>` : ''}</td>
                    <td><strong>${it.noTali}</strong></td>
                    <td>${it.konsumen}<br><small>${it.alamat || '-'}</small></td>
                    <td><span class="badge glass-panel" style="color:${statusColor}; border:1px solid ${statusColor}77; font-size:0.65rem; padding:4px 8px;">${it.status}</span></td>
                    <td align="center">
                        ${it.buktiUrl ? `
                            <button class="btn btn-sm btn-shimmer" onclick="window.viewDistPhoto('${it.buktiUrl}')" style="padding:2px 8px; font-size:0.75rem; border:none; background:var(--primary);">
                                🖼️ Lihat Foto
                            </button>
                        ` : '<span style="opacity:0.3">No Photo</span>'}
                    </td>
                `;
                body.appendChild(tr);
            });
        });
    };

    const renderLR = (trxs, goats, fin, start, end) => {
        const body = document.querySelector('#tableLR tbody');
        if(!body) return 0;
        body.innerHTML = '';

        let omzet = 0, hpp = 0, komisi = 0, saving = 0;
        const savingDetails = [];

        trxs.filter(t => {
            const dt = new Date(t.tgl_trx || t.tglTrx);
            return dt >= start && dt <= end;
        }).forEach(t => {
            omzet += (t.total_deal || t.totalDeal || 0);
            (t.items || []).forEach(it => {
                const g = goats.find(x => x.id === it.goatId);
                const sVal = parseFloat(g?.saving || 0);
                hpp += parseFloat(g?.harga_nota || 0);
                saving += sVal;
                if(sVal > 0) {
                    savingDetails.push({ trxId: t.id, noTali: it.noTali, customer: t.customer?.nama || '-', val: sVal });
                }
            });
            komisi += parseFloat(t.komisi?.nominal || 0);
        });

        let opex = 0;
        let deadLossRaw = 0;
        let deadKomp = 0;
        
        fin.filter(f => {
            const dt = new Date(f.tanggal);
            return dt >= start && dt <= end;
        }).forEach(f => {
            const nom = parseFloat(f.nominal || 0);
            if(f.tipe === 'pengeluaran') {
                const katLine = (f.kategori || '').toLowerCase();
                if(f.kategori === 'Kerugian (Mati/Hilang)') deadLossRaw += nom;
                else if(
                    !katLine.includes('bayar supplier') && 
                    !katLine.includes('pelunasan supplier') && 
                    !katLine.includes('komisi') && 
                    !katLine.includes('bagi hasil')
                ) {
                    opex += nom;
                }
            } else if(f.tipe === 'pemasukan') {
                if(f.kategori === 'Kompensasi Supplier') deadKomp += nom;
            }
        });

        const deadLossNet = deadLossRaw - deadKomp;

        const addRow = (l, v, cls='') => body.innerHTML += `<tr class="${cls}"><td>${l}</td><td class="text-right">${formatRp(v)}</td></tr>`;
        
        addRow('Total Omzet Penjualan', omzet, 'text-premium');
        addRow('(-) HPP (Harga Nota)', -hpp, 'text-muted');
        addRow('LABA KOTOR', omzet - hpp, 'row-total text-premium');
        addRow('(-) Komisi Agen', -komisi);
        addRow('(-) Biaya Operasional', -opex);
        addRow('(-) Kerugian Kematian (Bruto)', -deadLossRaw);
        if(deadKomp > 0) addRow('(+) Kompensasi Supplier', deadKomp, 'text-success');
        addRow('Kerugian Kematian (Netto)', -deadLossNet, 'row-total ' + (deadLossNet > 0 ? 'text-danger' : ''));
        
        const savingStr = saving > 0 ? `<br><small style="font-weight:normal; opacity:0.7">Audit Kalkulasi: Terhitung dari ${trxs.filter(t => {
            const dt = new Date(t.tgl_trx || t.tglTrx);
            return dt >= start && dt <= end;
        }).length} transaksi dalam periode ini.</small>` : '';
        addRow(`(-) Dana Saving (Titipan)${savingStr}`, -saving, 'text-warning');
        
        // Populate Saving Audit Table
        const auditContainer = document.getElementById('containerSavingAudit');
        const auditBody = document.querySelector('#tableSavingAudit tbody');
        if(auditContainer && auditBody) {
            if(savingDetails.length > 0) {
                auditContainer.style.display = 'block';
                auditBody.innerHTML = '';
                savingDetails.forEach(sd => {
                    auditBody.innerHTML += `
                        <tr>
                            <td>${sd.trxId}</td>
                            <td><strong>${sd.noTali}</strong></td>
                            <td>${sd.customer}</td>
                            <td class="text-right">${formatRp(sd.val)}</td>
                        </tr>
                    `;
                });
            } else {
                auditContainer.style.display = 'none';
            }
        }

        const netProfit = omzet - hpp - komisi - opex - deadLossNet - saving;
        addRow('LABA BERSIH', netProfit, 'row-grand-total text-premium');
        return netProfit;
    };

    const renderBagiHasil = async (netProfit, currentConfig) => {
        const body = document.querySelector('#tableBagiHasil tbody');
        if(!body) return;
        body.innerHTML = '';

        const inpOwner = document.getElementById('inpPersenOwner');
        const inpTeam = document.getElementById('inpPersenTeam');
        if(inpOwner && inpTeam) {
            inpOwner.value = currentConfig.owner;
            inpTeam.value = currentConfig.team;
            
            inpOwner.onchange = async () => {
                const val = parseInt(inpOwner.value) || 0;
                const newCfg = { owner: val, team: 100 - val };
                await supabase.from('master_data').upsert({ key: 'PORSI_BAGI_HASIL', val: newCfg });
                init();
            };
        }

        const pOwner = netProfit * (currentConfig.owner / 100);
        const pTeam = netProfit * (currentConfig.team / 100);

        const valHusni = document.getElementById('valPorsiHusni');
        const valTeam = document.getElementById('valPorsiTeam');
        if(valHusni) valHusni.textContent = formatRp(pOwner);
        if(valTeam) valTeam.textContent = formatRp(pTeam);

        body.innerHTML += `<tr><td>Porsi Owner (${currentConfig.owner}%)</td><td class="text-right"><b>${formatRp(pOwner)}</b></td></tr>`;
        body.innerHTML += `<tr><td>Porsi Tim (${currentConfig.team}%)</td><td class="text-right"><b>${formatRp(pTeam)}</b></td></tr>`;
    };

    const renderAK = (fin, start, end) => {
        const body = document.querySelector('#tableAK tbody');
        if(!body) return;
        body.innerHTML = '';

        const channels = {};
        fin.forEach(f => {
            const dt = new Date(f.tanggal);
            const chan = f.channel || 'Tunai';
            if (chan.toLowerCase().includes('non-kas')) return;
            const nom = parseFloat(f.nominal || 0);
            if(!channels[chan]) channels[chan] = { in: 0, out: 0, saldo: 0, show: false };
            
            // Saldo Kumulatif
            if(f.tipe === 'pemasukan') channels[chan].saldo += nom;
            else channels[chan].saldo -= nom;

            // Filter Periode
            if(dt >= start && dt <= end) {
                if(f.tipe === 'pemasukan') channels[chan].in += nom;
                else channels[chan].out += nom;
                channels[chan].show = true;
            }
        });

        Object.keys(channels).forEach(k => {
            if(!channels[k].show) return;
            body.innerHTML += `
                <tr>
                    <td><strong>${k}</strong></td>
                    <td class="text-right text-success">${formatRp(channels[k].in)}</td>
                    <td class="text-right text-danger">(${formatRp(channels[k].out)})</td>
                    <td class="text-right" style="font-weight:700;">${formatRp(channels[k].saldo)}</td>
                </tr>
            `;
        });
    };

    const renderNeraca = (fin, goats, trxs) => {
        const bodyAktiva = document.querySelector('#tableNR_Aktiva tbody');
        const bodyPasiva = document.querySelector('#tableNR_Pasiva tbody');
        if(!bodyAktiva || !bodyPasiva) return;
        bodyAktiva.innerHTML = ''; bodyPasiva.innerHTML = '';

        // 1. AKTIVA
        // A. KAS & BANK
        let totalCash = 0;
        const chans = {};
        fin.forEach(f => {
            const chan = f.channel || 'Tunai';
            if (chan.toLowerCase().includes('non-kas')) return; // Abaikan channel akuntansi
            
            const nom = f.nominal || 0;
            if(!chans[chan]) chans[chan] = 0;
            chans[chan] += (f.tipe === 'pemasukan' ? 1 : -1) * nom;
        });
        Object.keys(chans).forEach(k => {
            if(chans[k] === 0) return;
            bodyAktiva.innerHTML += `<tr><td>Kas/Bank: ${k}</td><td class="text-right">${formatRp(chans[k])}</td></tr>`;
            totalCash += chans[k];
        });

        // B. STOK (HPP)
        const totalStokHPP = goats.filter(g => g.status_transaksi === 'Tersedia').reduce((s,g) => s + (g.harga_nota || 0), 0);
        bodyAktiva.innerHTML += `<tr><td>Persediaan Kambing (HPP)</td><td class="text-right">${formatRp(totalStokHPP)}</td></tr>`;

        // C. PIUTANG KONSUMEN
        const totalPiutang = trxs.reduce((s,t) => s + ((t.total_deal || 0) - (t.total_paid || 0)), 0);
        bodyAktiva.innerHTML += `<tr><td>Piutang Konsumen</td><td class="text-right">${formatRp(totalPiutang)}</td></tr>`;

        const grandAktiva = totalCash + totalStokHPP + totalPiutang;
        bodyAktiva.innerHTML += `<tr class="row-grand-total"><td>TOTAL AKTIVA</td><td class="text-right">${formatRp(grandAktiva)}</td></tr>`;

        // 2. PASIVA
        // A. HUTANG SUPPLIER
        const totalTagihanSupplier = goats.reduce((s,g) => s + (g.harga_nota || 0), 0);
        const totalSudahBayarSupplier = fin.filter(f => f.kategori === 'Bayar Supplier' || f.kategori === 'Pelunasan Supplier').reduce((s,f) => s + f.nominal, 0);
        const totalKompensasiSupplier = fin.filter(f => f.kategori === 'Kompensasi Supplier').reduce((s,f) => s + f.nominal, 0);
        const sisaHutangSupplier = totalTagihanSupplier - totalSudahBayarSupplier - totalKompensasiSupplier;
        
        bodyPasiva.innerHTML += `<tr><td>Hutang Supplier</td><td class="text-right">${formatRp(sisaHutangSupplier)}</td></tr>`;

        // B. MODAL & LABA DITAHAN (BALANCING)
        const modalLaba = grandAktiva - sisaHutangSupplier;
        bodyPasiva.innerHTML += `<tr><td>Modal & Laba Ditahan</td><td class="text-right">${formatRp(modalLaba)}</td></tr>`;

        bodyPasiva.innerHTML += `<tr class="row-grand-total"><td>TOTAL PASIVA</td><td class="text-right">${formatRp(grandAktiva)}</td></tr>`;
    };


    const renderOperasional = (goats, trxs) => {
        // 1. Health Rate per Batch
        const bodyHealth = document.querySelector('#tableOPE_Health tbody');
        if(bodyHealth) {
            bodyHealth.innerHTML = '';
            const batches = [...new Set(goats.map(g => g.batch))];
            batches.forEach(b => {
                const bGoats = goats.filter(g => g.batch === b);
                const mati = bGoats.filter(g => g.status_kesehatan === 'Mati' || g.status_fisik === 'Mati' || g.status_kesehatan === 'Hilang').length;
                const total = bGoats.length;
                const hRate = ((total - mati) / total * 100).toFixed(1);
                const color = hRate < 95 ? '#ef4444' : 'var(--success)';
                
                bodyHealth.innerHTML += `
                    <tr>
                        <td><strong>${b}</strong></td>
                        <td>${total} Ekor</td>
                        <td style="color:#ef4444">${mati} Ekor</td>
                        <td style="font-weight:700; color:${color}">${hRate}%</td>
                    </tr>
                `;
            });
        }

        // 2. Aging Piutang
        const bodyAging = document.querySelector('#tableOPE_Aging tbody');
        if(bodyAging) {
            bodyAging.innerHTML = '';
            const aging = { '0-30 Hari': { c: 0, v: 0 }, '31-60 Hari': { c: 0, v: 0 }, '61+ Hari': { c: 0, v: 0 } };
            const now = new Date();
            trxs.filter(t => (t.total_paid || 0) < (t.total_deal || 0)).forEach(t => {
                const diff = Math.floor((now - new Date(t.tgl_trx || t.tglTrx)) / (1000 * 60 * 60 * 24));
                const key = diff <= 30 ? '0-30 Hari' : diff <= 60 ? '31-60 Hari' : '61+ Hari';
                aging[key].c++;
                aging[key].v += ((t.total_deal || 0) - (t.total_paid || 0));
            });
            Object.keys(aging).forEach(k => {
                bodyAging.innerHTML += `<tr><td>${k}</td><td>${aging[k].c} Order</td><td align="right" style="font-weight:600; color:var(--warning)">${formatRp(aging[k].v)}</td></tr>`;
            });
        }
    };

    const renderAnalytics = (goats, trxs, fin, start, end) => {
        // Filter Data
        const fFin = fin.filter(f => { const d = new Date(f.tanggal); return d >= start && d <= end; });
        const fTrxs = trxs.filter(t => { const d = new Date(t.tgl_trx || t.tglTrx); return d >= start && d <= end; });

        // 1. KPI Scorecards
        const opex = fFin.filter(f => f.tipe === 'pengeluaran' && !['Bayar Supplier', 'Pelunasan Supplier', 'Bagi Hasil (Investor)'].includes(f.kategori)).reduce((s,f) => s + f.nominal, 0);
        const activeGoats = goats.filter(g => g.status_transaksi === 'Tersedia').length || 1;
        const cph = opex / activeGoats;
        
        const totalGoats = goats.length || 1;
        const dead = goats.filter(g => g.status_kesehatan === 'Mati' || g.status_fisik === 'Mati').length;
        const mortality = (dead / totalGoats * 100).toFixed(1);

        const totalProfit = fTrxs.reduce((s, t) => {
            const deal = t.total_deal || t.totalDeal || 0;
            const hpp = (t.items || []).reduce((sh, it) => {
                const g = goats.find(x => x.id === it.goatId);
                return sh + (g?.harga_nota || 0);
            }, 0);
            const komisi = t.komisi?.nominal || 0;
            return s + (deal - hpp - komisi);
        }, 0);
        const avgProfit = fTrxs.length ? totalProfit / fTrxs.length : 0;

        document.getElementById('kpiCPH').textContent = formatRp(cph);
        document.getElementById('kpiMortality').textContent = mortality + '%';
        document.getElementById('kpiMortality').style.color = mortality > 5 ? '#ef4444' : 'var(--success)';
        document.getElementById('kpiAvgProfit').textContent = formatRp(avgProfit);

        // 2. Expense Distribution
        const bodyCat = document.querySelector('#tableAnalisisKategori tbody');
        if(bodyCat) {
            bodyCat.innerHTML = '';
            const cats = {};
            fFin.filter(f => f.tipe === 'pengeluaran').forEach(f => {
                cats[f.kategori] = (cats[f.kategori] || 0) + f.nominal;
            });
            const totalExp = Object.values(cats).reduce((s,v) => s+v, 0) || 1;
            Object.keys(cats).sort((a,b) => cats[b] - cats[a]).forEach(k => {
                bodyCat.innerHTML += `<tr><td>${k}</td><td align="right">${formatRp(cats[k])}</td><td align="right">${(cats[k]/totalExp*100).toFixed(1)}%</td></tr>`;
            });
        }

        // 3. Top Performance Agen
        const bodyAgen = document.querySelector('#tableAnalisisAgen tbody');
        if(bodyAgen) {
            bodyAgen.innerHTML = '';
            const perf = {};
            fTrxs.forEach(t => {
                const name = t.agen?.nama || 'Direct/Walk-In';
                if(!perf[name]) perf[name] = { name, count: 0, deal: 0, profit: 0, type: t.agen?.tipe || '-' };
                perf[name].count += (t.items || []).length;
                perf[name].deal += (t.total_deal || 0);
                
                const hpp = (t.items || []).reduce((sh, it) => {
                    const g = goats.find(x => x.id === it.goatId);
                    return sh + (g?.harga_nota || 0);
                }, 0);
                perf[name].profit += ((t.total_deal || 0) - hpp - (t.komisi?.nominal || 0));
            });
            Object.values(perf).sort((a,b) => b.deal - a.deal).forEach(p => {
                bodyAgen.innerHTML += `
                    <tr>
                        <td><strong>${p.name}</strong></td>
                        <td><small>${p.type}</small></td>
                        <td align="right">${p.count} Ekor</td>
                        <td align="right" style="font-weight:600">${formatRp(p.deal)}</td>
                        <td align="right" style="color:var(--success)">${formatRp(p.profit / (p.count || 1))}</td>
                    </tr>
                `;
            });
        }
    };

    const debugText = document.getElementById('debugText');
    const debugDetails = document.getElementById('debugDetails');
    const updateDebug = (msg, details = '') => {
        if(debugText) debugText.textContent = msg;
        if(debugDetails) {
            debugDetails.textContent = details;
            debugDetails.style.display = details ? 'block' : 'none';
        }
    };

    const init = async () => {
        updateDebug('Menghubungkan ke Pusat Data...', 'Sinkronisasi Supabase...');
        const btn = document.getElementById('btnRender');
        if(btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Memproses...'; }

        try {
            const { trxs, goats, fin, config, trips } = await loadData();
            
            const startStr = document.getElementById('inpStartDate').value;
            const endStr = document.getElementById('inpEndDate').value;
            const start = new Date(startStr);
            const end = new Date(endStr);
            end.setHours(23,59,59);

            updateDebug(`Menganalisis ${trxs.length} Transaksi & ${goats.length} Stok...`, `Periode: ${startStr} s/d ${endStr}`);

            // Apply Fade-In to results
            const content = document.querySelector('.content-area');
            if(content) {
                content.classList.remove('fade-in');
                void content.offsetWidth; // Trigger reflow
                content.classList.add('fade-in');
            }

            const net = renderLR(trxs, goats, fin, start, end);
            renderAK(fin, start, end);
            renderNeraca(fin, goats, trxs);
            renderDistribusi(trips, start, end);
            renderBagiHasil(net, config);
            renderOperasional(goats, trxs);
            renderAnalytics(goats, trxs, fin, start, end);

            updateDebug('✅ Laporan Strategis Berhasil Diperbarui', `${fin.length} baris keuangan diproses secara realtime.`);
        } catch (err) {
            updateDebug('❌ Gagal Memproses Data', err.message);
            console.error(err);
        } finally {
            if(btn) { btn.disabled = false; btn.innerHTML = '🔍 Proses Data'; }
        }
    };

    document.getElementById('btnRender')?.addEventListener('click', init);
    
    // Auto Handle Range Selector
    document.getElementById('selRange')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const container = document.getElementById('customDateContainer');
        const today = new Date();
        
        if(val === 'custom') {
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
            if(val === 'thisMonth') {
                document.getElementById('inpStartDate').value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                document.getElementById('inpEndDate').value = today.toISOString().split('T')[0];
            } else if(val === 'thisYear') {
                document.getElementById('inpStartDate').value = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                document.getElementById('inpEndDate').value = today.toISOString().split('T')[0];
            } else if(val === 'all') {
                document.getElementById('inpStartDate').value = '2024-01-01';
                document.getElementById('inpEndDate').value = today.toISOString().split('T')[0];
            }
            init();
        }
    });

    // Initial Load
    const today = new Date();
    if(!document.getElementById('inpStartDate').value) {
        document.getElementById('inpStartDate').value = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    }
    if(!document.getElementById('inpEndDate').value) {
        document.getElementById('inpEndDate').value = today.toISOString().split('T')[0];
    }
    // Global Photo Viewer for Distribusi
    window.viewDistPhoto = (url) => {
        const directUrl = window.getDirectDriveLink(url);
        window.showAlert(`
            <div style="width:100%; text-align:center;">
                <img src="${directUrl}" style="max-width:100%; border-radius:8px; box-shadow:0 5px 15px rgba(0,0,0,0.5);">
            </div>
        `, 'info');
    };

    init();
});
