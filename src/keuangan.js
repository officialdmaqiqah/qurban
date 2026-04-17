import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; 

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    if(profile.email) {
        const emailDisplay = document.getElementById('userEmailDisplay');
        if(emailDisplay) emailDisplay.textContent = profile.email;
    }

    // --- ELEMENT SELECTORS ---
    const modalKeuangan = document.getElementById('modalKeuangan');
    const formKeuangan = document.getElementById('formKeuangan');
    const modalTitle = document.getElementById('modalTitle');
    const tipeInput = document.getElementById('transaksiTipe');
    const tanggalInput = document.getElementById('transaksiTanggal');
    const kategoriInput = document.getElementById('transaksiKategori');
    const kategoriLainInput = document.getElementById('transaksiKategoriLain');
    const containerKategori = document.getElementById('containerKategori');
    const containerKategoriLain = document.getElementById('containerKategoriLain');
    const containerMutasiTujuan = document.getElementById('containerMutasiTujuan');
    const transaksiMutasiTujuan = document.getElementById('transaksiMutasiTujuan');
    const nominalInput = document.getElementById('transaksiNominal');
    const keteranganInput = document.getElementById('transaksiKeterangan');
    const transaksiChannel = document.getElementById('transaksiChannel');
    const containerTransaksiRek = document.getElementById('containerTransaksiRek');
    const transaksiRekId = document.getElementById('transaksiRekId');
    const inpBuktiKeuangan = document.getElementById('inpBuktiKeuangan');
    const previewBuktiKeuangan = document.getElementById('previewBuktiKeuangan');
    const imgPreviewKeu = previewBuktiKeuangan ? previewBuktiKeuangan.querySelector('img') : null;
    const btnSaveModal = document.getElementById('btnSaveModal');

    const tableBody = document.getElementById('tableBodyKeuangan');
    const emptyState = document.getElementById('emptyState');
    const totalPemasukanEl = document.getElementById('totalPemasukan');
    const totalPengeluaranEl = document.getElementById('totalPengeluaran');

    let officialKatIn = [];
    let officialKatOut = [];
    let currentSort = { column: 'tanggal', direction: 'desc' };

    // --- UTILITIES ---
    const formatRp = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
    const formatDate = (dateString) => {
        if(!dateString) return '-';
        const d = new Date(dateString);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    const loadAndSyncCategories = async () => {
        try {
            const { data: catIn } = await supabase.from('master_data').select('val').eq('key', 'KAT_KEU_IN').single();
            const { data: catOut } = await supabase.from('master_data').select('val').eq('key', 'KAT_KEU_OUT').single();
            if (catIn) officialKatIn = catIn.val;
            if (catOut) officialKatOut = catOut.val;
        } catch (e) { console.error("Error categories sync:", e); }
    };

    const getKeuanganData = async () => {
        const { data } = await supabase.from('keuangan').select('*');
        return data || [];
    };

    const getTransaksiMap = async () => {
        const { data } = await supabase.from('transaksi').select('id, customer, agen');
        const map = {};
        (data || []).forEach(t => map[t.id] = t);
        return map;
    };

    const getBankAccounts = async () => {
        const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single();
        if (data?.val?.length > 0) return data.val;
        const { data: oldData } = await supabase.from('master_data').select('val').eq('key', 'BANK_ACCOUNTS').single();
        return oldData?.val || [];
    };

    async function checkSaldoCukup(channel, nominal, label) {
        const data = await getKeuanganData();
        let s = 0;
        const target = (channel || '').toLowerCase().trim();
        data.forEach(item => {
            const ch = (item.channel || 'Tunai / Cash').toLowerCase().trim();
            if(ch === target || ch.includes(target) || target.includes(ch)) {
                if(item.tipe === 'pemasukan') s += (parseFloat(item.nominal) || 0);
                if(item.tipe === 'pengeluaran') s -= (parseFloat(item.nominal) || 0);
            }
        });
        if(s < nominal) {
            window.showAlert(`⚠️ <b>Saldo Tidak Cukup!</b><br><br>Saldo di <b>${label}</b> saat ini: <b>${formatRp(s)}</b>.`, 'warning');
            return false;
        }
        return true;
    }

    const populateKategori = async (tipe) => {
        if(!kategoriInput) return;
        kategoriInput.innerHTML = '';
        const list = [...(tipe === 'pemasukan' ? officialKatIn : officialKatOut), 'Lainnya (Tulis Sendiri)'];
        list.forEach(k => {
            const o = document.createElement('option'); o.value = k; o.textContent = k;
            kategoriInput.appendChild(o);
        });
    };

    const renderApp = async () => {
        let inTotal = 0, outTotal = 0;
        const [data, trxMap] = await Promise.all([getKeuanganData(), getTransaksiMap()]);
        if(tableBody) tableBody.innerHTML = '';
        
        const filterChannel = document.getElementById('filterChannel');
        const filterKategori = document.getElementById('filterKategori');
        const filterTipe = document.getElementById('filterTipe');
        const searchInput = document.getElementById('inpSearchKeuangan');

        // Populate Filters
        const uniqueChannels = [...new Set(data.map(d => d.channel || 'Tunai / Cash'))].sort();
        const uniqueKategori = [...new Set(data.map(d => d.kategori).filter(Boolean))].sort();

        if(filterChannel) {
            const prev = filterChannel.value;
            filterChannel.innerHTML = '<option value="">Semua Channel</option>';
            uniqueChannels.forEach(ch => {
                const o = document.createElement('option'); o.value = ch; o.textContent = ch;
                filterChannel.appendChild(o);
            });
            filterChannel.value = prev;
        }
        if(filterKategori) {
            const prev = filterKategori.value;
            filterKategori.innerHTML = '<option value="">Semua Kategori</option>';
            uniqueKategori.forEach(k => {
                const o = document.createElement('option'); o.value = k; o.textContent = k;
                filterKategori.appendChild(o);
            });
            filterKategori.value = prev;
        }

        // Process Data
        let processed = data.map(item => ({ ...item, transaksi: item.related_trx_id ? trxMap[item.related_trx_id] : null }));
        if (filterTipe?.value) processed = processed.filter(item => item.tipe === filterTipe.value);
        if (filterChannel?.value) processed = processed.filter(item => (item.channel || 'Tunai / Cash') === filterChannel.value);
        if (filterKategori?.value) processed = processed.filter(item => item.kategori === filterKategori.value);
        
        const searchKeyword = (searchInput?.value || '').toLowerCase();
        if (searchKeyword) {
            processed = processed.filter(item => 
                (item.id || '').toLowerCase().includes(searchKeyword) ||
                (item.kategori || '').toLowerCase().includes(searchKeyword) ||
                (item.keterangan || '').toLowerCase().includes(searchKeyword) ||
                (item.transaksi?.customer?.nama || '').toLowerCase().includes(searchKeyword)
            );
        }

        processed.sort((a, b) => {
            let valA = a[currentSort.column], valB = b[currentSort.column];
            if(currentSort.column === 'nominal') { valA = parseFloat(a.nominal); valB = parseFloat(b.nominal); }
            return currentSort.direction === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });

        // ── Render Table ──
        if(tableBody) {
            tableBody.closest('table').style.display = processed.length > 0 ? 'table' : 'none';
            if(emptyState) emptyState.style.display = processed.length > 0 ? 'none' : 'block';
            processed.forEach(item => {
                const isIncome = item.tipe === 'pemasukan';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td data-label="ID" style="font-size:0.7rem; color:var(--text-muted)">${item.id || '-'}</td>
                    <td data-label="TANGGAL">${formatDate(item.tanggal)}</td>
                    <td data-label="KONSUMEN" style="font-size:0.85rem;">${item.transaksi?.customer?.nama || '-'}</td>
                    <td data-label="AGEN" style="font-size:0.85rem;">${item.transaksi?.agen?.nama || '-'}</td>
                    <td data-label="KATEGORI"><span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">${item.kategori}</span></td>
                    <td data-label="KETERANGAN" style="font-size:0.85rem;">${item.keterangan || '-'}</td>
                    <td data-label="NOMINAL" style="color:${isIncome ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">${formatRp(item.nominal)}</td>
                    <td data-label="TIPE">${item.tipe}</td>
                    <td data-label="CHANNEL">${item.channel || '-'}</td>
                    <td data-label="PHOTO" style="text-align:center;">
                        ${item.bukti_url ? `<button class="btn btn-sm" onclick="window.viewPhoto('${item.bukti_url}')"><img src="${window.getDirectDriveLink(item.bukti_url)}" style="width:24px; height:24px; object-fit:cover;"></button>` : '🚫'}
                    </td>
                    <td data-label="AKSI" style="white-space:nowrap;">
                        <button class="btn btn-sm btn-edit-action" data-id="${item.id}">✏️</button>
                        <button class="btn btn-sm btn-delete-action" data-id="${item.id}">🗑️</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // ── BALANCES WIDGET ──
        let balances = { 'Tunai / Cash': 0 };
        const rekenings = await getBankAccounts();
        rekenings.forEach(acc => { balances[`TF ${acc.bank} - ${acc.norek} (${acc.an})`] = 0; });

        data.forEach(item => {
            const ch = item.channel || 'Tunai / Cash';
            if (item.tipe === 'pemasukan') {
                balances[ch] = (balances[ch] || 0) + parseFloat(item.nominal || 0);
                inTotal += parseFloat(item.nominal || 0);
            } else if (item.tipe === 'pengeluaran') {
                balances[ch] = (balances[ch] || 0) - parseFloat(item.nominal || 0);
                outTotal += parseFloat(item.nominal || 0);
            }
        });

        if(totalPemasukanEl) totalPemasukanEl.textContent = formatRp(inTotal);
        if(totalPengeluaranEl) totalPengeluaranEl.textContent = formatRp(outTotal);

        const containerBalance = document.getElementById('containerRealtimeBalance');
        if(containerBalance) {
            containerBalance.innerHTML = '';
            Object.entries(balances).sort().forEach(([chan, val]) => {
                let label = chan.replace('TF ', 'Bank ');
                if (label.includes(' (')) label = label.split(' (')[0];
                containerBalance.innerHTML += `
                <div class="balance-card">
                    <div class="balance-info">
                        <div class="balance-label">${label.toUpperCase()}</div>
                        <div class="balance-value" style="color:${val < 0 ? 'var(--danger)' : 'var(--success)'}">
                            ${formatRp(val)}
                        </div>
                    </div>
                </div>`;
            });
        }

        document.querySelectorAll('.btn-edit-action').forEach(btn => btn.onclick = () => handleEdit(btn.dataset.id));
        document.querySelectorAll('.btn-delete-action').forEach(btn => btn.onclick = () => handleDelete(btn.dataset.id));
    };

    // --- EXPORT & SYNC ---
    const handleSyncAll = async () => {
        window.showConfirm('Sinkronkan saldo transaksi?', async () => {
            window.showToast('Memulai...', 'info');
            const { data: trxs } = await supabase.from('transaksi').select('id');
            const { data: fins } = await supabase.from('keuangan').select('*');
            for (const trx of (trxs || [])) {
                const rel = (fins || []).filter(f => f.related_trx_id === trx.id);
                const total = rel.reduce((s, f) => s + (parseFloat(f.nominal) || 0), 0);
                const history = rel.map(f => ({ payId: f.id, tgl: f.tanggal, nominal: parseFloat(f.nominal), channel: f.channel, buktiUrl: f.bukti_url }));
                await supabase.from('transaksi').update({ total_paid: total, history_bayar: history }).eq('id', trx.id);
            }
            window.showAlert('Sinkron Berhasil!', 'success', () => window.location.reload());
        });
    };

    const handleExport = async () => {
        const btn = document.getElementById('btnExportKeuangan');
        if(btn) { btn.disabled = true; btn.innerText = 'Memproses...'; }
        try {
            const { data: keuData } = await supabase.from('keuangan').select('*').order('tanggal', { ascending: false });
            if(!keuData || keuData.length === 0) return window.showAlert('Tidak ada data.', 'warning');
            const ws = XLSX.utils.json_to_sheet(keuData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Keuangan');
            XLSX.writeFile(wb, `Keuangan_Qurban_${new Date().toISOString().slice(0,10)}.xlsx`);
            window.showToast('Export Berhasil!', 'success');
        } catch(err) { window.showAlert('Gagal: ' + err.message, 'danger'); }
        finally { if(btn) { btn.disabled = false; btn.innerText = '📥 Export Excel'; } }
    };

    // --- MODAL HELPERS ---
    const resetModal = () => {
        window.editingId = null; window.oldNominal = 0; window.oldTrxId = null; window.existingKeuBukti = null;
        formKeuangan.reset();
        if(previewBuktiKeuangan) previewBuktiKeuangan.style.display = 'none';
        if(containerKategoriLain) containerKategoriLain.style.display = 'none';
        if(containerTransaksiRek) containerTransaksiRek.style.display = 'none';
    };

    // --- ATTACH LISTENERS ---
    document.getElementById('btnTambahPemasukan')?.addEventListener('click', () => { resetModal(); tipeInput.value = 'pemasukan'; modalTitle.textContent = 'Catat Pemasukan'; tanggalInput.value = window.getLocalDate(); containerKategori.style.display = 'block'; containerMutasiTujuan.style.display = 'none'; populateKategori('pemasukan'); modalKeuangan.classList.add('active'); });
    document.getElementById('btnTambahPengeluaran')?.addEventListener('click', () => { resetModal(); tipeInput.value = 'pengeluaran'; modalTitle.textContent = 'Catat Pengeluaran'; tanggalInput.value = window.getLocalDate(); containerKategori.style.display = 'block'; containerMutasiTujuan.style.display = 'none'; populateKategori('pengeluaran'); modalKeuangan.classList.add('active'); });
    document.getElementById('btnTambahMutasi')?.addEventListener('click', async () => {
        resetModal(); tipeInput.value = 'mutasi'; modalTitle.textContent = '⇄ Mutasi Antar Rekening'; tanggalInput.value = window.getLocalDate(); containerKategori.style.display = 'none'; containerMutasiTujuan.style.display = 'block'; 
        transaksiMutasiTujuan.innerHTML = '<option value="">-- Pilih Tujuan --</option><option value="Tunai">💵 Tunai / Cash</option><option value="Kas Operasional">🏷️ Kas Operasional</option>';
        const reks = await getBankAccounts();
        reks.forEach(r => {
            const o = document.createElement('option'); o.value = r.id; o.textContent = `TF ${r.bank} - ${r.norek} (${r.an})`;
            transaksiMutasiTujuan.appendChild(o);
        });
        modalKeuangan.classList.add('active');
    });

    formKeuangan?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const originalText = btnSaveModal ? btnSaveModal.innerHTML : 'Simpan';
        if (btnSaveModal) { btnSaveModal.disabled = true; btnSaveModal.innerText = 'Menyimpan...'; }
        window.showToast('Memproses...', 'info');

        try {
            const nominal = window.parseNum(nominalInput.value);
            const tgl = tanggalInput.value;
            const kat = kategoriInput.value;
            const ket = (keteranganInput.value || '').trim();
            const tipe = tipeInput.value;
            const chan = transaksiChannel.value;

            if(!tgl || nominal <= 0 || !ket) throw new Error('Cek kembali tanggal, nominal, dan keterangan.');
            
            let finalChannel = chan;
            if(chan === 'Transfer Bank') {
                const opt = transaksiRekId.options[transaksiRekId.selectedIndex];
                finalChannel = opt ? `TF ${opt.textContent}` : 'Transfer Bank';
            }

            if(tipe === 'mutasi') {
                const dest = transaksiMutasiTujuan.value;
                if(!dest) throw new Error('Pilih tujuan!');
                let destChannel = (dest === 'Tunai') ? 'Tunai / Cash' : (dest === 'Kas Operasional' ? 'Kas Operasional' : transaksiMutasiTujuan.options[transaksiMutasiTujuan.selectedIndex].textContent);
                const mid = 'MUT-' + Date.now().toString().slice(-6);
                await supabase.from('keuangan').insert([
                    { id: mid + '-O', tipe: 'pengeluaran', tanggal: tgl, kategori: 'Mutasi Antar Rekening', nominal, keterangan: 'Simpan Ke ' + destChannel + ' | ' + ket, channel: finalChannel },
                    { id: mid + '-I', tipe: 'pemasukan', tanggal: tgl, kategori: 'Mutasi Antar Rekening', nominal, keterangan: 'Terima Dari ' + finalChannel + ' | ' + ket, channel: destChannel }
                ]);
            } else {
                await supabase.from('keuangan').upsert([{ 
                    id: window.editingId || ('FIN-' + Date.now().toString().slice(-6)),
                    tipe, tanggal: tgl, kategori: kat, nominal, keterangan: ket, channel: finalChannel
                }]);
            }
            window.showToast('Berhasil!', 'success');
            modalKeuangan.classList.remove('active');
            renderApp();
        } catch (err) { window.showAlert(err.message, 'danger'); }
        finally { if (btnSaveModal) { btnSaveModal.disabled = false; btnSaveModal.innerHTML = originalText; } }
    });

    if(btnSaveModal) btnSaveModal.onclick = () => formKeuangan?.requestSubmit();

    transaksiChannel?.addEventListener('change', async () => {
        if(transaksiChannel.value === 'Transfer Bank') {
            const reks = await getBankAccounts();
            containerTransaksiRek.style.display = 'block';
            transaksiRekId.innerHTML = '<option value="">-- Pilih --</option>';
            reks.forEach(r => {
                const o = document.createElement('option'); o.value = r.id; o.textContent = `${r.bank} - ${r.norek} (${r.an})`;
                transaksiRekId.appendChild(o);
            });
        } else containerTransaksiRek.style.display = 'none';
    });

    document.getElementById('btnCloseModal')?.addEventListener('click', () => modalKeuangan.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modalKeuangan.classList.remove('active'));
    document.getElementById('btnExportKeuangan')?.addEventListener('click', handleExport);
    
    // Auth & Init
    const isAuthorized = ['admin', 'office', 'staf', 'operator'].includes((profile.role || '').toLowerCase().trim());
    if (isAuthorized) {
        const actionContainer = document.querySelector('.card-box .flex-between div:last-child');
        if (actionContainer && !document.getElementById('btnSyncKeuangan')) {
            const btnSync = document.createElement('button');
            btnSync.id = 'btnSyncKeuangan'; btnSync.className = 'btn';
            btnSync.style.cssText = 'background:rgba(16,185,129,0.1); color:#10b981; margin-right: 0.5rem;';
            btnSync.innerHTML = '🔄 Sinkron Data'; btnSync.onclick = handleSyncAll;
            actionContainer.prepend(btnSync);
        }
    }

    window.setupMoneyMask('transaksiNominal');
    await loadAndSyncCategories();
    await renderApp();
    window.showToast('Sistem Keuangan Siap', 'success');
});
