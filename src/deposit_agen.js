import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Elements
    const tableBodySaldo = document.getElementById('tableBodySaldoAgen');
    const tableBodyRiwayat = document.getElementById('tableBodyRiwayat');
    const statsTotalTitipan = document.getElementById('statsTotalTitipan');
    const statsTotalTerpakai = document.getElementById('statsTotalTerpakai');
    const statsTotalAktif = document.getElementById('statsTotalAktif');
    
    const modalDeposit = document.getElementById('modalDeposit');
    const formDeposit = document.getElementById('formDeposit');
    const btnTambahDeposit = document.getElementById('btnTambahDeposit');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');
    
    const inpAgenName = document.getElementById('inpAgenName');
    const inpNominal = document.getElementById('inpNominal');
    const inpTgl = document.getElementById('inpTgl');
    const inpChannel = document.getElementById('inpChannel');
    const containerRek = document.getElementById('containerRek');
    const inpRekId = document.getElementById('inpRekId');

    // 2. Immediate Event Listeners (Must be registered early)
    if (btnTambahDeposit) {
        btnTambahDeposit.onclick = () => {
            initForm();
            modalDeposit.classList.add('active');
        };
    }
    if (btnCloseModal) btnCloseModal.onclick = () => modalDeposit.classList.remove('active');
    if (btnCancelModal) btnCancelModal.onclick = () => modalDeposit.classList.remove('active');

    // Modal Detail Rekap Agen close buttons
    const modalDetailAgen = document.getElementById('modalDetailAgen');
    const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');
    const btnCloseDetailModal2 = document.getElementById('btnCloseDetailModal2');
    
    if (btnCloseDetailModal) btnCloseDetailModal.onclick = () => modalDetailAgen.classList.remove('active');
    if (btnCloseDetailModal2) btnCloseDetailModal2.onclick = () => modalDetailAgen.classList.remove('active');

    if (inpChannel) {
        inpChannel.onchange = async () => {
            if (inpChannel.value === 'Transfer Bank') {
                containerRek.style.display = 'block';
                const reks = await getRekening();
                inpRekId.innerHTML = '<option value="">-- Pilih Rekening --</option>';
                reks.forEach(r => {
                    const opt = document.createElement('option');
                    opt.value = r.id;
                    opt.textContent = `${r.bank} - ${r.norek} (${r.an})`;
                    inpRekId.appendChild(opt);
                });
            } else {
                containerRek.style.display = 'none';
            }
        };
    }

    const inpKategori = document.getElementById('inpKategori');
    if (inpKategori) {
        inpKategori.onchange = () => {
            const safeguard = document.getElementById('safeguardWarning');
            if (safeguard) {
                safeguard.style.display = (inpKategori.value === 'Penarikan Titipan Agen') ? 'block' : 'none';
            }
        };
    }

    if (formDeposit) {
        formDeposit.onsubmit = async (e) => {
            e.preventDefault();
            try {
                const id = document.getElementById('editId').value || 'DEP-' + Date.now();
                const kat = document.getElementById('inpKategori').value;
                const tipe = (kat === 'Titipan Dana Agen') ? 'pemasukan' : 'pengeluaran';
                const nominal = window.parseNum(inpNominal.value);
                let channel = inpChannel.value;
                if (channel === 'Transfer Bank' && inpRekId.value) {
                    channel = `TF ${inpRekId.options[inpRekId.selectedIndex].textContent}`;
                }

                const data = {
                    id,
                    tanggal: inpTgl.value,
                    tipe,
                    kategori: kat,
                    nominal,
                    channel,
                    agen_name: inpAgenName.value,
                    keterangan: document.getElementById('inpKeterangan').value,
                    rek_id: inpRekId.value || null
                };

                const { error } = await supabase.from('keuangan').upsert([data]);
                if (error) throw error;
                
                window.showToast('Transaksi Berhasil Disimpan', 'success');
                modalDeposit.classList.remove('active');
                refreshData();
            } catch (err) {
                window.showAlert('Gagal menyimpan: ' + err.message, 'danger');
            }
        };
    }

    // 3. DB Helpers
    async function getAgens() {
        const { data } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
        return data?.val || [];
    }

    async function getRekening() {
        const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single();
        if (data?.val?.length) return data.val;
        const { data: old } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single();
        return old?.val || [];
    }

    async function initForm() {
        inpTgl.value = window.getLocalDate();
        inpNominal.value = '';
        const editIdEl = document.getElementById('editId');
        if (editIdEl) editIdEl.value = '';
        const modalTitleEl = document.getElementById('modalTitle');
        if (modalTitleEl) modalTitleEl.textContent = 'Tambah Titipan Dana';
        
        window.setupMoneyMask(inpNominal);
        
        try {
            const agens = await getAgens();
            agens.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
            inpAgenName.innerHTML = '<option value="">-- Pilih Agen --</option>';
            agens.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.nama;
                opt.textContent = `${a.nama} (${a.jenis || 'Agen'})`;
                inpAgenName.appendChild(opt);
            });
        } catch (e) { console.error("Gagal memuat daftar agen:", e); }
    }

    async function refreshData() {
        try {
            // Fetch Keuangan & Transaksi parallelly for efficiency
            const [respK, respT] = await Promise.all([
                supabase.from('keuangan').select('*').order('tanggal', { ascending: false }),
                supabase.from('transaksi').select('*')
            ]);
            
            if (respK.error) throw respK.error;
            if (respT.error) throw respT.error;
            
            const keuangan = respK.data || [];
            const transaksi = respT.data || [];

            const agens = await getAgens();
            
            const depKats = ['Titipan Dana Agen', 'Pemakaian Titipan Agen', 'Penarikan Titipan Agen'];
            const depRows = keuangan.filter(f => depKats.includes(f.kategori));

            const balances = {};
            agens.forEach(a => { 
                balances[a.nama] = { in: 0, out: 0, balance: 0, tagihan: 0, outstandingOrders: [] }; 
            });

            // Calculate deposit balance
            let totalIn = 0;
            let totalOut = 0;

            depRows.forEach(f => {
                const name = f.agen_name || '';
                const nom = parseFloat(f.nominal) || 0;
                
                if (balances[name]) {
                    if (f.kategori === 'Titipan Dana Agen') {
                        if (f.tipe === 'pemasukan') {
                            balances[name].in += nom;
                            totalIn += nom;
                        } else {
                            balances[name].out += nom;
                            totalOut += nom;
                        }
                    } else {
                        balances[name].out += nom;
                        totalOut += nom;
                    }
                }
            });

            // Calculate accumulated outstanding bills per agent
            let totalTagihanGlobal = 0;
            transaksi.forEach(trx => {
                const sisa = (trx.total_deal || 0) - (trx.total_paid || 0);
                if (sisa > 0) {
                    const agentName = trx.agen?.nama || '';
                    if (agentName && balances[agentName]) {
                        balances[agentName].tagihan += sisa;
                        balances[agentName].outstandingOrders.push({
                            id: trx.id,
                            customer: trx.customer?.nama || '-',
                            deal: trx.total_deal || 0,
                            paid: trx.total_paid || 0,
                            sisa: sisa
                        });
                        totalTagihanGlobal += sisa;
                    }
                }
            });

            tableBodySaldo.innerHTML = '';
            Object.keys(balances).forEach(name => {
                const b = balances[name];
                // Show agent if they have EITHER deposit transactions OR outstanding bills
                if (b.in === 0 && b.out === 0 && b.tagihan === 0) return;
                
                const tr = document.createElement('tr');
                const saldoAktif = b.in - b.out;
                
                // Styling based on balance vs tagihan
                const tagihanStyle = b.tagihan > 0 ? 'color:#ef4444; font-weight:700;' : 'color:var(--text-muted); opacity:0.5;';
                
                tr.innerHTML = `
                    <td><strong>${name}</strong></td>
                    <td class="text-right text-success">${window.formatRp(b.in)}</td>
                    <td class="text-right text-danger">${window.formatRp(b.out)}</td>
                    <td class="text-right font-bold" style="color: ${saldoAktif > 0 ? '#10b981' : ''}">${window.formatRp(saldoAktif)}</td>
                    <td class="text-right" style="${tagihanStyle}">${window.formatRp(b.tagihan)}</td>
                    <td class="text-right">
                        <button class="btn btn-sm btn-detail-agen btn-primary" data-name="${name}" style="font-size: 0.7rem; padding: 4px 8px; border-radius: 6px;">📊 Detail</button>
                    </td>
                `;
                tableBodySaldo.appendChild(tr);
            });
            
            document.querySelectorAll('.btn-detail-agen').forEach(btn => {
                btn.onclick = () => window.viewAgentHistory(btn.getAttribute('data-name'));
            });

            if (tableBodySaldo.innerHTML === '') tableBodySaldo.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada data agen aktif.</td></tr>';

            tableBodyRiwayat.innerHTML = '';
            depRows.forEach(f => {
                const tr = document.createElement('tr');
                const isOut = f.kategori !== 'Titipan Dana Agen' || f.tipe === 'pengeluaran';
                tr.innerHTML = `
                    <td>${f.tanggal}</td>
                    <td>${f.agen_name || '-'}</td>
                    <td><span class="badge ${isOut ? 'badge-danger' : 'badge-success'}">${f.kategori}</span></td>
                    <td><small>${f.keterangan || '-'}</small></td>
                    <td>${f.channel || '-'}</td>
                    <td class="text-right font-bold ${isOut ? 'text-danger' : 'text-success'}">${isOut ? '-' : '+'}${window.formatRp(f.nominal)}</td>
                    <td class="text-right">
                        <button class="btn btn-sm btn-del-dep" data-id="${f.id}">🗑️</button>
                    </td>
                `;
                tableBodyRiwayat.appendChild(tr);
            });
            
            document.querySelectorAll('.btn-del-dep').forEach(btn => {
                btn.onclick = () => window.deleteDeposit(btn.getAttribute('data-id'));
            });

            if (tableBodyRiwayat.innerHTML === '') tableBodyRiwayat.innerHTML = '<tr><td colspan="7" class="text-center">Belum ada riwayat transaksi.</td></tr>';

            statsTotalTitipan.textContent = window.formatRp(totalIn);
            statsTotalTerpakai.textContent = window.formatRp(totalOut);
            statsTotalAktif.textContent = window.formatRp(totalIn - totalOut);
            
            const statsTotalTagihan = document.getElementById('statsTotalTagihan');
            if (statsTotalTagihan) statsTotalTagihan.textContent = window.formatRp(totalTagihanGlobal);
            
            // Save calculated data globally for modal view
            window._cachedAgentBalances = balances;
            window._cachedAgentDepHistory = depRows;

        } catch (e) {
            console.error("Gagal Memuat Data:", e);
            window.showToast("Gagal memuat data terbaru", "danger");
        }
    }

    // 4. Auth & Initial Load
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        // Load Profile
        supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data: profile }) => {
            if (profile && document.getElementById('userEmailDisplay')) {
                document.getElementById('userEmailDisplay').textContent = profile.email;
            }
        });

        refreshData();
    } catch (e) { console.error("Auth Fail:", e); }


    // Global window functions
    window.deleteDeposit = function(id) {
        window.showConfirm('Hapus transaksi ini?', async function() {
            try {
                const { error } = await supabase.from('keuangan').delete().eq('id', id);
                if (error) throw error;
                window.showToast('Terhapus'); 
                refreshData();
            } catch (err) { window.showAlert('Gagal menghapus: ' + err.message, 'danger'); }
        });
    };

    window.viewAgentHistory = function(name) {
        const balances = window._cachedAgentBalances || {};
        const depHistory = window._cachedAgentDepHistory || [];
        
        const b = balances[name] || { in: 0, out: 0, balance: 0, tagihan: 0, outstandingOrders: [] };
        const saldoAktif = b.in - b.out;
        
        // 1. Populate summary cards
        document.getElementById('detailAgenName').textContent = name;
        document.getElementById('detailSaldoAktif').textContent = window.formatRp(saldoAktif);
        document.getElementById('detailTagihanAkumulasi').textContent = window.formatRp(b.tagihan);
        
        const netValue = saldoAktif - b.tagihan;
        const netEl = document.getElementById('detailKombinasiNet');
        netEl.textContent = window.formatRp(netValue);
        if (netValue > 0) {
            netEl.style.color = '#10b981'; // Green
        } else if (netValue < 0) {
            netEl.style.color = '#ef4444'; // Red
        } else {
            netEl.style.color = '';
        }

        // 2. Populate Outstanding Orders
        const tableBodyOrders = document.getElementById('tableBodyDetailOrders');
        tableBodyOrders.innerHTML = '';
        if (b.outstandingOrders.length === 0) {
            tableBodyOrders.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:20px;">Tidak ada tagihan berjalan. Semua lunas! 🎉</td></tr>';
        } else {
            b.outstandingOrders.forEach(o => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${o.id}</strong></td>
                    <td>${o.customer}</td>
                    <td class="text-right">${window.formatRp(o.deal)}</td>
                    <td class="text-right text-success">${window.formatRp(o.paid)}</td>
                    <td class="text-right text-danger font-bold">${window.formatRp(o.sisa)}</td>
                `;
                tableBodyOrders.appendChild(tr);
            });
        }

        // 3. Populate Deposit History
        const tableBodyHist = document.getElementById('tableBodyDetailHistory');
        tableBodyHist.innerHTML = '';
        const agentDeps = depHistory.filter(f => f.agen_name === name);
        if (agentDeps.length === 0) {
            tableBodyHist.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:20px;">Tidak ada riwayat deposit.</td></tr>';
        } else {
            agentDeps.forEach(f => {
                const tr = document.createElement('tr');
                const isOut = f.kategori !== 'Titipan Dana Agen' || f.tipe === 'pengeluaran';
                tr.innerHTML = `
                    <td>${f.tanggal}</td>
                    <td><span class="badge ${isOut ? 'badge-danger' : 'badge-success'}">${f.kategori}</span></td>
                    <td><small>${f.keterangan || '-'}</small></td>
                    <td class="text-right font-bold ${isOut ? 'text-danger' : 'text-success'}">${isOut ? '-' : '+'}${window.formatRp(f.nominal)}</td>
                `;
                tableBodyHist.appendChild(tr);
            });
        }

        // 4. Open Modal
        document.getElementById('modalDetailAgen').classList.add('active');
    };

    // UNIVERSAL AUTO-HEAL LOOP
    async function autoHealAgentBalances() {
        try {
            // 1. Ambil semua Pemasukan dari Saldo Titipan Agen (Pelunasan Order & Refund)
            const { data: allPelunasan } = await supabase.from('keuangan')
                .select('*')
                .eq('channel', 'Saldo Titipan Agen')
                .in('tipe', ['pemasukan', 'pengeluaran']); 

            const { data: allPemakaian } = await supabase.from('keuangan')
                .select('*')
                .eq('channel', 'Saldo Titipan Agen')
                .eq('kategori', 'Pemakaian Titipan Agen');

            // --- 1. CLEANUP ALL DUPLICATES ---
            const pemakaianGrouped = {};
            (allPemakaian || []).forEach(m => {
                if (!m.related_trx_id) return;
                if (!pemakaianGrouped[m.related_trx_id]) pemakaianGrouped[m.related_trx_id] = [];
                pemakaianGrouped[m.related_trx_id].push(m);
            });

            let duplicateIdsToDelete = [];
            Object.keys(pemakaianGrouped).forEach(trxId => {
                const arr = pemakaianGrouped[trxId];
                if (arr.length > 1) {
                    // Keep the first one, delete the rest
                    const toDelete = arr.slice(1).map(x => x.id);
                    duplicateIdsToDelete.push(...toDelete);
                }
            });

            if (duplicateIdsToDelete.length > 0) {
                await supabase.from('keuangan').delete().in('id', duplicateIdsToDelete);
                console.log('[Auto-Heal] Cleaned up general duplicates:', duplicateIdsToDelete);
                // remove them from our memory array so we don't trip over them
                duplicateIdsToDelete.forEach(id => {
                    const idx = allPemakaian.findIndex(m => m.id === id);
                    if (idx !== -1) allPemakaian.splice(idx, 1);
                });
            }

            // --- 2. CREATE MISSING PAIRS ---
            let fixedCount = 0;
            for (const p of (allPelunasan || [])) {
                if (p.kategori === 'Pelunasan Order' && p.tipe === 'pemasukan' && p.related_trx_id) {
                    const hasPasangan = allPemakaian.some(m => m.related_trx_id === p.related_trx_id);
                    if (!hasPasangan) {
                        const { data: trx } = await supabase.from('transaksi').select('agen').eq('id', p.related_trx_id).single();
                        const agenName = trx?.agen?.nama || 'Bana'; 

                        const depId = 'DEP-' + Date.now().toString().slice(-6) + '-' + p.related_trx_id.slice(-4);
                        await supabase.from('keuangan').insert([{
                            id: depId,
                            tipe: 'pengeluaran',
                            tanggal: p.tanggal,
                            kategori: 'Pemakaian Titipan Agen',
                            nominal: p.nominal,
                            channel: 'Saldo Titipan Agen',
                            agen_name: agenName,
                            related_trx_id: p.related_trx_id,
                            keterangan: `Pemakaian saldo otomatis untuk ${p.related_trx_id} (Auto-Heal)`
                        }]);
                        fixedCount++;
                    }
                }
            }
            if (fixedCount > 0) {
                console.log(`[Auto-Heal] Fixed ${fixedCount} missing agent deductions.`);
                if (typeof refreshData === 'function') refreshData();
            }
        } catch(e) {
            console.error('[Auto-Heal] Error:', e);
        }
    }

    // Run silently in background
    setTimeout(autoHealAgentBalances, 3000);

});
