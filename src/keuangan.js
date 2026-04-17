import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; 

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if(email) {
        const emailDisplay = document.getElementById('userEmailDisplay');
        if(emailDisplay) emailDisplay.textContent = email;
    }

    // --- ELEMENT SELECTORS ---
    const modalKeuangan = document.getElementById('modalKeuangan');
    const formKeuangan = document.getElementById('formKeuangan');
    const modalTitle = document.getElementById('modalTitle');
    const originalIdInput = document.getElementById('transaksiIdOriginal');
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
    const btnRemoveKeuPhoto = document.getElementById('btnRemoveKeuPhoto');
    const btnOpenCameraKeu = document.getElementById('btnOpenCameraKeu');
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
            const defIn = ['Modal Awal','Terima Pelunasan','Penjualan Sapi','Jual Kambing','Kompensasi Supplier','Penerimaan Lainnya'];
            const defOut = ['Beli Kambing','Beban Pakan','Beban Operasional Kandang','Gaji & Bonus','Listrik & Air','Transportasi','Marketing / Iklan','Bayar Supplier','Pelunasan Supplier','Bagi Hasil (Investor)','Prive / Tarik Tunai','Biaya Lain-lain','Kerugian (Mati/Hilang)'];

            if (!catIn || !catOut) {
                const { data: rows } = await supabase.from('keuangan').select('kategori, tipe');
                const uniqueIn = rows ? [...new Set(rows.filter(x => x.tipe === 'pemasukan').map(x => x.kategori))].filter(Boolean) : [];
                const uniqueOut = rows ? [...new Set(rows.filter(x => x.tipe === 'pengeluaran').map(x => x.kategori))].filter(Boolean) : [];
                officialKatIn = [...new Set([...defIn, ...uniqueIn])].filter(x => x !== 'Lainnya (Tulis Sendiri)');
                officialKatOut = [...new Set([...defOut, ...uniqueOut])].filter(x => x !== 'Lainnya (Tulis Sendiri)');
                await supabase.from('master_data').upsert([
                    { id: 'ID-KAT-KEU-IN', key: 'KAT_KEU_IN', val: officialKatIn },
                    { id: 'ID-KAT-KEU-OUT', key: 'KAT_KEU_OUT', val: officialKatOut }
                ], { onConflict: 'key' });
            } else {
                officialKatIn = catIn.val;
                officialKatOut = catOut.val;
            }
        } catch (e) { console.error("Error categories sync:", e); }
    };

    const getKeuanganData = async () => {
        const { data, error } = await supabase.from('keuangan').select('*');
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

    const checkSaldoCukup = async (channel, nominal, label) => {
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
            window.showAlert(`ss- <b>Saldo Tidak Cukup!</b><br><br>Saldo di <b>${label}</b> saat ini: <b>${formatRp(s)}</b>.`, 'warning');
            return false;
        }
        return true;
    };

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

        const uniqueChannels = [...new Set(data.map(d => {
            let ch = d.channel || 'Tunai / Cash';
            if(['Cash','Tunai','-','Tunai/Lainnya'].includes(ch)) ch = 'Tunai / Cash';
            return ch;
        }))].sort();
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

        if(tableBody) {
            tableBody.closest('table').style.display = processed.length > 0 ? 'table' : 'none';
            if(emptyState) emptyState.style.display = processed.length > 0 ? 'none' : 'block';
            processed.forEach(item => {
                const isIncome = item.tipe === 'pemasukan';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td data-label="ID" style="font-size:0.7rem; color:var(--text-muted)">${item.id || '-'}</td>
                    <td data-label="TANGGAL">${formatDate(item.tanggal)}</td>
                    <td data-label="KONSUMEN">${item.transaksi?.customer?.nama || '-'}</td>
                    <td data-label="AGEN">${item.transaksi?.agen?.nama || '-'}</td>
                    <td data-label="KATEGORI"><span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">${item.kategori}</span></td>
                    <td data-label="KETERANGAN">${item.keterangan || '-'}</td>
                    <td data-label="NOMINAL" style="color:${isIncome ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">${formatRp(item.nominal)}</td>
                    <td data-label="TIPE">${item.tipe}</td>
                    <td data-label="CHANNEL">${item.channel || '-'}</td>
                    <td data-label="PHOTO" style="text-align:center;">
                        ${item.bukti_url ? `<button class="btn btn-sm" onclick="window.viewPhoto('${item.bukti_url}')"><img src="${window.getDirectDriveLink(item.bukti_url)}" style="width:24px; height:24px; object-fit:cover;"></button>` : '🚫'}
                    </td>
                    <td data-label="AKSI">
                        <button class="btn btn-sm btn-edit-action" data-id="${item.id}">✏️</button>
                        <button class="btn btn-sm btn-delete-action" data-id="${item.id}">🗑️</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // Summary calculations
        data.forEach(item => {
            if(item.tipe === 'pemasukan') inTotal += parseFloat(item.nominal || 0);
            else if(item.tipe === 'pengeluaran') outTotal += parseFloat(item.nominal || 0);
        });
        if(totalPemasukanEl) totalPemasukanEl.textContent = formatRp(inTotal);
        if(totalPengeluaranEl) totalPengeluaranEl.textContent = formatRp(outTotal);

        document.querySelectorAll('.btn-edit-action').forEach(btn => btn.onclick = () => handleEdit(btn.dataset.id));
        document.querySelectorAll('.btn-delete-action').forEach(btn => btn.onclick = () => handleDelete(btn.dataset.id));
    };

    // --- BUTTON HANDLERS ---
    const resetModal = () => {
        window.editingId = null;
        window.oldNominal = 0;
        window.oldTrxId = null;
        window.existingKeuBukti = null;
        formKeuangan.reset();
        previewBuktiKeuangan.style.display = 'none';
        containerKategoriLain.style.display = 'none';
    };

    document.getElementById('btnTambahPemasukan')?.addEventListener('click', () => {
        resetModal();
        tipeInput.value = 'pemasukan';
        modalTitle.textContent = 'Catat Pemasukan';
        tanggalInput.value = window.getLocalDate();
        containerKategori.style.display = 'block';
        containerMutasiTujuan.style.display = 'none';
        populateKategori('pemasukan');
        modalKeuangan.classList.add('active');
    });

    document.getElementById('btnTambahPengeluaran')?.addEventListener('click', () => {
        resetModal();
        tipeInput.value = 'pengeluaran';
        modalTitle.textContent = 'Catat Pengeluaran';
        tanggalInput.value = window.getLocalDate();
        containerKategori.style.display = 'block';
        containerMutasiTujuan.style.display = 'none';
        populateKategori('pengeluaran');
        modalKeuangan.classList.add('active');
    });

    document.getElementById('btnTambahMutasi')?.addEventListener('click', async () => {
        resetModal();
        tipeInput.value = 'mutasi';
        modalTitle.textContent = '⇄ Mutasi Antar Rekening';
        tanggalInput.value = window.getLocalDate();
        containerKategori.style.display = 'none';
        containerMutasiTujuan.style.display = 'block';
        transaksiChannel.value = 'Tunai';
        containerTransaksiRek.style.display = 'none';
        
        transaksiMutasiTujuan.innerHTML = '<option value="">-- Pilih Tujuan --</option><option value="Tunai">💵 Tunai / Cash</option><option value="Kas Operasional">🏷️ Kas Operasional</option>';
        const reks = await getBankAccounts();
        reks.forEach(r => {
            const o = document.createElement('option');
            o.value = r.id; o.textContent = `TF ${r.bank} - ${r.norek} (${r.an})`;
            transaksiMutasiTujuan.appendChild(o);
        });
        modalKeuangan.classList.add('active');
    });

    const handleEdit = async (id) => {
        const { data: item } = await supabase.from('keuangan').select('*').eq('id', id).single();
        if(!item) return;
        resetModal();
        window.editingId = item.id;
        window.oldNominal = parseFloat(item.nominal);
        window.oldTrxId = item.related_trx_id;
        modalTitle.textContent = 'Edit Transaksi';
        tipeInput.value = item.tipe;
        tanggalInput.value = item.tanggal;
        nominalInput.value = item.nominal;
        keteranganInput.value = item.keterangan;
        await populateKategori(item.tipe);
        kategoriInput.value = item.kategori;
        if(item.bukti_url) { imgPreviewKeu.src = window.getDirectDriveLink(item.bukti_url); previewBuktiKeuangan.style.display = 'flex'; window.existingKeuBukti = item.bukti_url; }
        modalKeuangan.classList.add('active');
    };

    const handleDelete = async (id) => {
        window.showConfirm('Hapus transaksi ini?', async () => {
            await supabase.from('keuangan').delete().eq('id', id);
            renderApp();
            window.showToast('Data dihapus', 'success');
        });
    };

    // --- SAVE LOGIC ---
    const handleSave = async (e) => {
        if(e) e.preventDefault();
        
        const originalText = btnSaveModal ? btnSaveModal.innerHTML : 'Simpan';
        if (btnSaveModal) { btnSaveModal.disabled = true; btnSaveModal.innerText = 'Menyimpan...'; }
        
        window.showToast('Memulai proses simpan...', 'info');

        try {
            const nominal = window.parseNum(nominalInput.value);
            const tgl = tanggalInput.value;
            const kat = kategoriInput.value;
            const ket = (keteranganInput.value || '').trim();
            const tipe = tipeInput.value;
            const chan = transaksiChannel.value;

            if (!tgl) throw new Error('Pilih tanggal!');
            if (nominal <= 0) throw new Error('Isi nominal!');
            if (!ket) throw new Error('Isi keterangan!');
            if (tipe !== 'mutasi' && !kat) throw new Error('Pilih kategori!');

            let finalChannel = chan;
            if(chan === 'Transfer Bank') {
                const opt = transaksiRekId.options[transaksiRekId.selectedIndex];
                finalChannel = opt ? `TF ${opt.textContent}` : 'Transfer Bank';
            }

            if(tipe === 'mutasi') {
                const dest = transaksiMutasiTujuan.value;
                if(!dest) throw new Error('Pilih tujuan mutasi!');
                let destChannel = dest === 'Tunai' ? 'Tunai / Cash' : (dest === 'Kas Operasional' ? 'Kas Operasional' : transaksiMutasiTujuan.options[transaksiMutasiTujuan.selectedIndex].textContent);
                
                const mid = 'MUT-' + Date.now().toString().slice(-6);
                const payload = [
                    { id: mid + '-O', tipe: 'pengeluaran', tanggal: tgl, kategori: 'Mutasi Antar Rekening', nominal, keterangan: 'Mutasi Ke ' + destChannel + ' | ' + ket, channel: finalChannel },
                    { id: mid + '-I', tipe: 'pemasukan', tanggal: tgl, kategori: 'Mutasi Antar Rekening', nominal, keterangan: 'Mutasi Dari ' + finalChannel + ' | ' + ket, channel: destChannel }
                ];
                const { error } = await supabase.from('keuangan').insert(payload);
                if(error) throw error;
            } else {
                const payload = { 
                    id: window.editingId || ('FIN-' + Date.now().toString().slice(-6)),
                    tipe, tanggal: tgl, kategori: kat === 'Lainnya (Tulis Sendiri)' ? kategoriLainInput.value : kat,
                    nominal, keterangan: ket, channel: finalChannel
                };
                const { error } = await supabase.from('keuangan').upsert([payload]);
                if(error) throw error;
            }

            window.showToast('Berhasil disimpan!', 'success');
            modalKeuangan.classList.remove('active');
            renderApp();
        } catch (err) {
            window.showAlert(err.message, 'danger');
        } finally {
            if (btnSaveModal) { btnSaveModal.disabled = false; btnSaveModal.innerHTML = originalText; }
        }
    };

    // --- ATTACH LISTENERS ---
    formKeuangan?.addEventListener('submit', handleSave);
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
        } else { containerTransaksiRek.style.display = 'none'; }
    });

    document.getElementById('btnCloseModal')?.addEventListener('click', () => modalKeuangan.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modalKeuangan.classList.remove('active'));
    
    // Initial load
    window.setupMoneyMask('transaksiNominal');
    await loadAndSyncCategories();
    await renderApp();
    
    window.showToast('Sistem Keuangan Siap', 'success');
});
