import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const email = profile.email;
    if(email) {
        const emailDisplay = document.getElementById('userEmailDisplay');
        if(emailDisplay) emailDisplay.textContent = email;
    }


    const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);
    const formatDate = (dateString) => {
        if(!dateString) return '-';
        const d = new Date(dateString);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const tableBody = document.getElementById('tableBodyKeuangan');
    const emptyState = document.getElementById('emptyState');
    const totalPemasukanEl = document.getElementById('totalPemasukan');
    const totalPengeluaranEl = document.getElementById('totalPengeluaran');

    let currentSort = { column: 'tanggal', direction: 'desc' };

    const modalKeuangan = document.getElementById('modalKeuangan');
    const formKeuangan = document.getElementById('formKeuangan');
    const modalTitle = document.getElementById('modalTitle');
    
    const originalIdInput = document.getElementById('transaksiIdOriginal');
    const tipeInput = document.getElementById('transaksiTipe');
    const tanggalInput = document.getElementById('transaksiTanggal');
    const kategoriInput = document.getElementById('transaksiKategori');
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

    // DB Helpers
    const getKeuanganData = async () => {
        const { data, error } = await supabase.from('keuangan').select('*');
        if(error) { console.error("Error fetching keuangan:", error); return []; }
        return data || [];
    };

    const getBankAccounts = async () => {
        const { data } = await supabase.from('master_data').select('val').eq('key', 'REKENING').single();
        if (data && data.val && data.val.length > 0) return data.val;
        
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
            if(window.showAlert) window.showAlert(`⚠️ <b>Saldo Tidak Cukup!</b><br><br>Saldo di <b>${label}</b> saat ini: <b>${formatRp(s)}</b>.`, 'warning');
            return false;
        }
        return true;
    }

    async function renderApp() {
        let inTotal = 0;
        let outTotal = 0;
        const data = await getKeuanganData();
        if(tableBody) tableBody.innerHTML = '';
        
        let processed = [...data];

        // Search Filter
        const searchInput = document.getElementById('inpSearchKeuangan');
        const searchKeyword = (searchInput ? searchInput.value : '').toLowerCase();
        if (searchKeyword) {
            processed = processed.filter(item => 
                (item.id || '').toLowerCase().includes(searchKeyword) ||
                (item.kategori || '').toLowerCase().includes(searchKeyword) ||
                (item.keterangan || '').toLowerCase().includes(searchKeyword) ||
                (item.channel || '').toLowerCase().includes(searchKeyword)
            );
        }

        // Sorting Logic
        processed.sort((a, b) => {
            let valA, valB;
            switch(currentSort.column) {
                case 'tanggal': valA = a.tanggal || ''; valB = b.tanggal || ''; break;
                case 'nominal': valA = parseFloat(a.nominal) || 0; valB = parseFloat(b.nominal) || 0; break;
                default: valA = a[currentSort.column] || ''; valB = b[currentSort.column] || '';
            }
            return currentSort.direction === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });

        // --- PHOTO UTILITIES (Reuse from kambing.js) ---
        const GDRIVE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwVd01SmNkuoUwinekKbDAh3meqs8ZsbR-OZoCBPUcHZ3_jcBQST6p5vrSVJULt_t8/exec';

        async function compressImage(file) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (e) => {
                    const img = new Image();
                    img.src = e.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        let width = img.width;
                        let height = img.height;
                        const max = 800;
                        if (width > height) { if (width > max) { height *= max / width; width = max; } } 
                        else { if (height > max) { width *= max / height; height = max; } }
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
                    };
                };
            });
        }

        async function uploadToGDrive(base64, folderName) {
            try {
                const response = await fetch(GDRIVE_PROXY_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        base64: base64,
                        mimeType: "image/jpeg",
                        fileName: "keuangan_" + Date.now() + ".jpg",
                        folderName: folderName || "BUKTI_KEUANGAN"
                    })
                });
                const result = await response.json();
                if(result.success) return window.getDirectDriveLink(result.url);
                return null;
            } catch (error) {
                console.error('GDrive Upload failed:', error);
                return null;
            }
        }

        const isVisible = processed.length > 0;
        if(tableBody) {
            tableBody.closest('table').style.display = isVisible ? 'table' : 'none';
            if(emptyState) emptyState.style.display = isVisible ? 'none' : 'block';
        }

        let balances = { 'Tunai / Cash': 0 };
        const rekenings = await getBankAccounts();
        rekenings.forEach(acc => { balances[`TF ${acc.bank} - ${acc.norek} (${acc.an})`] = 0; });

        data.forEach(item => {
            const channelRaw = item.channel || 'Tunai / Cash';
            let channelName = channelRaw;
            if(['Cash', 'Tunai', 'Tunai / Cash', '-', 'Tunai/Lainnya'].includes(channelName)) channelName = 'Tunai / Cash';
            const isNonKas = channelName.toLowerCase().includes('non-kas') || channelName.toLowerCase().includes('lainnya');
            if (!isNonKas) {
                if (item.tipe === 'pemasukan') inTotal += (parseFloat(item.nominal) || 0);
                if (item.tipe === 'pengeluaran') outTotal += (parseFloat(item.nominal) || 0);
            }
            if(!balances.hasOwnProperty(channelName)) balances[channelName] = 0;
            if (item.tipe === 'pemasukan') balances[channelName] += (parseFloat(item.nominal) || 0);
            if (item.tipe === 'pengeluaran') balances[channelName] -= (parseFloat(item.nominal) || 0);
        });

        const isRestrictedFinance = typeof window.isRestricted === 'function' ? window.isRestricted('hideKeuangan') : false;

        if(tableBody && isVisible) {
            processed.forEach((item) => {
                const isIncome = item.tipe === 'pemasukan';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-size:0.7rem; color:var(--text-muted)">${item.id || '-'}</td>
                    <td>${formatDate(item.tanggal)}</td>
                    <td><span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">${item.kategori}</span></td>
                    <td>${item.keterangan || '-'}</td>
                    <td style="color: ${isIncome ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                        ${isRestrictedFinance ? '***' : (isIncome ? '+' : '-') + ' ' + formatRp(item.nominal)}
                    </td>
                    <td style="font-size:0.8rem; text-transform:capitalize;">${item.tipe}</td>
                    <td style="font-size:0.8rem; color:var(--text-muted)">${item.channel || '-'}</td>
                     <td style="text-align:center;">
                         ${item.bukti_url ? `
                             <button class="btn btn-sm" onclick="window.viewPhoto('${item.bukti_url}')" style="width:30px; height:30px; border-radius:4px; padding:0; overflow:hidden; border:1px solid rgba(255,255,255,0.1); cursor:pointer;">
                                 <img src="${window.getDirectDriveLink(item.bukti_url)}" style="width:100%; height:100%; object-fit:cover; pointer-events:none;">
                             </button>
                         ` : '<span style="opacity:0.2">🚫</span>'}
                     </td>
                     <td style="white-space:nowrap;">
                        <button class="btn btn-sm btn-edit-action" data-id="${item.id}" title="Edit" style="background:rgba(168,85,247,0.1); color:#a855f7; margin-right:4px;">✏️</button>
                        <button class="btn btn-sm btn-delete-action" data-id="${item.id}" title="Hapus" style="background:rgba(239,68,68,0.1); color:var(--danger);">🗑️</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }
        
        const containerBalance = document.getElementById('containerRealtimeBalance');
        if(containerBalance) {
            containerBalance.innerHTML = '';
            for (const [chan, val] of Object.entries(balances)) {
                if(chan.toLowerCase().includes('non-kas') && val === 0) continue;
                const isBank = chan.toLowerCase().includes('tf ') || chan.toLowerCase().includes('bank');
                const icon = isBank ? '🏦' : '💵';
                const label = chan.replace('TF ', 'Bank ');
                containerBalance.innerHTML += `
                <div class="balance-card">
                    <div class="balance-icon">${icon}</div>
                    <div class="balance-info">
                        <div class="balance-label">${label}</div>
                        <div class="balance-value" style="color:${val < 0 ? 'var(--danger)' : 'var(--success)'}">
                            ${isRestrictedFinance ? '********' : formatRp(val)}
                        </div>
                    </div>
                </div>`;
            }
        }
        if(totalPemasukanEl) totalPemasukanEl.textContent = isRestrictedFinance ? '********' : formatRp(inTotal);
        if(totalPengeluaranEl) totalPengeluaranEl.textContent = isRestrictedFinance ? '********' : formatRp(outTotal);

        document.querySelectorAll('.btn-edit-action').forEach(btn => btn.onclick = () => handleEdit(btn.dataset.id));
        document.querySelectorAll('.btn-delete-action').forEach(btn => btn.onclick = () => handleDelete(btn.dataset.id));
         
        document.querySelectorAll('.btn-view-photo').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                window.viewPhoto(btn.dataset.url);
            };
        });
    }

    async function handleDelete(id) {
        const { data: item } = await supabase.from('keuangan').select('*').eq('id', id).single();
        if(!item) return;
        
        window.showConfirm(`Hapus transaksi ${id}?`, async () => {
            // Delete the record first
            await supabase.from('keuangan').delete().eq('id', id);

            // If related to a sale, RECALCULATE for absolute accuracy
            if(item.related_trx_id) {
                const { data: relatedFins } = await supabase.from('keuangan').select('*').eq('related_trx_id', item.related_trx_id);
                const total = (relatedFins || []).reduce((s, f) => s + (parseFloat(f.nominal) || 0), 0);
                const history = (relatedFins || []).map(f => ({
                    payId: f.id,
                    tgl: f.tanggal,
                    nominal: parseFloat(f.nominal),
                    channel: f.channel,
                    buktiUrl: f.bukti_url
                }));

                await supabase.from('transaksi').update({ 
                    total_paid: Math.max(0, total), 
                    history_bayar: history 
                }).eq('id', item.related_trx_id);
            }

            await renderApp();
            if(window.showToast) window.showToast('Data dihapus & Saldo sinkron ulang', 'success');
        }, null, 'Hapus Transaksi', 'Ya, Hapus', 'btn-danger');
    }

    async function handleEdit(id) {
        const { data: item } = await supabase.from('keuangan').select('*').eq('id', id).single();
        if(!item) return;

        window.editingId = item.id;
        window.oldNominal = parseFloat(item.nominal) || 0;
        window.oldTrxId = item.related_trx_id;

        modalTitle.textContent = 'Edit Transaksi ' + item.tipe.toUpperCase();
        tipeInput.value = item.tipe;
        tanggalInput.value = item.tanggal;
        nominalInput.value = item.nominal;
        keteranganInput.value = item.keterangan;
        originalIdInput.value = item.id;

        // Load Categories
        await populateKategori(item.tipe);
        kategoriInput.value = item.kategori;

        // Handle Channel
        const chan = item.channel || 'Tunai';
        if(chan.startsWith('TF ')) {
            transaksiChannel.value = 'Transfer Bank';
            const reks = await getBankAccounts();
            containerTransaksiRek.style.display = 'block';
            transaksiRekId.innerHTML = '<option value="">-- Pilih --</option>';
            const rekLabel = chan.replace('TF ', '').trim();
            reks.forEach(r => {
                const o = document.createElement('option');
                o.value = r.id; o.textContent = `${r.bank} - ${r.norek} (${r.an})`;
                if(o.textContent.includes(rekLabel)) o.selected = true;
                transaksiRekId.appendChild(o);
            });
        } else {
            transaksiChannel.value = (chan === 'QRIS') ? 'QRIS' : 'Tunai';
            containerTransaksiRek.style.display = 'none';
        }

        // Preview Photo
        if(item.bukti_url) {
            imgPreviewKeu.src = window.getDirectDriveLink(item.bukti_url);
            previewBuktiKeuangan.style.display = 'flex';
            window.existingKeuBukti = item.bukti_url;
        } else {
            previewBuktiKeuangan.style.display = 'none';
            window.existingKeuBukti = null;
        }

        modalKeuangan.classList.add('active');
    }

    const handleSave = async (e) => {
        e.preventDefault();
        const id = window.editingId || ('FIN-' + Date.now().toString().slice(-6));
        const tipe = tipeInput.value;
        const nominal = parseFloat(nominalInput.value);
        const tgl = tanggalInput.value;
        const kat = kategoriInput.value;
        const ket = keteranganInput.value;
        const chan = transaksiChannel.value;
        
        let finalChannel = chan;
        if(chan === 'Transfer Bank' && transaksiRekId.value) {
            const opt = transaksiRekId.options[transaksiRekId.selectedIndex];
            finalChannel = `TF ${opt.textContent}`;
        }

        if(tipe === 'pengeluaran' && !['Prive / Tarik Tunai'].includes(kat)) {
            const checkNominal = window.editingId ? (nominal - window.oldNominal) : nominal;
            if(checkNominal > 0) {
                if(!await checkSaldoCukup(finalChannel, checkNominal, finalChannel)) return;
            }
        }

        let buktiUrl = window.existingKeuBukti || null;
        if(inpBuktiKeuangan && inpBuktiKeuangan.files.length > 0) {
            window.showToast('Mengompres & Mengunggah bukti...', 'info');
            const b64 = await compressImage(inpBuktiKeuangan.files[0]);
            buktiUrl = await uploadToGDrive(b64, "BUKTI_KEUANGAN");
        }

        const payload = {
            id, tipe, tanggal: tgl, kategori: kat, nominal, keterangan: ket, channel: finalChannel, bukti_url: buktiUrl
        };

        const { error } = await supabase.from('keuangan').upsert([payload]);

        if(!error) {
            // SYNC WITH TRANSAKSI IF RELATED
            const currentTrxId = window.oldTrxId;
            if (currentTrxId) {
                const { data: trx } = await supabase.from('transaksi').select('*').eq('id', currentTrxId).single();
                if (trx) {
                    let updatedPaid = (parseFloat(trx.total_paid) || 0);
                    if (window.editingId) updatedPaid = updatedPaid - window.oldNominal + nominal;
                    else updatedPaid += nominal;

                    let history = trx.history_bayar || [];
                    const hIdx = history.findIndex(h => h.payId === id);
                    const hData = { payId: id, tgl, nominal, channel: finalChannel, buktiUrl };
                    if (hIdx >= 0) history[hIdx] = hData;
                    else history.push(hData);

                    await supabase.from('transaksi').update({ 
                        total_paid: Math.max(0, updatedPaid), 
                        history_bayar: history 
                    }).eq('id', currentTrxId);
                }
            }

            window.showToast('Data berhasil disimpan!', 'success');
            modalKeuangan.classList.remove('active');
            window.editingId = null;
            window.oldNominal = 0;
            window.oldTrxId = null;
            window.existingKeuBukti = null;
            renderApp();
        } else {
            window.showAlert('Gagal menyimpan data: ' + error.message, 'danger');
        }
    };

    formKeuangan?.addEventListener('submit', handleSave);

    transaksiChannel?.addEventListener('change', async () => {
        if(transaksiChannel.value === 'Transfer Bank') {
            const reks = await getBankAccounts();
            containerTransaksiRek.style.display = 'block';
            transaksiRekId.innerHTML = '<option value="">-- Pilih --</option>';
            reks.forEach(r => {
                const o = document.createElement('option');
                o.value = r.id; o.textContent = `${r.bank} - ${r.norek} (${r.an})`;
                transaksiRekId.appendChild(o);
            });
        } else { containerTransaksiRek.style.display = 'none'; }
    });

    // Photo Listeners
     inpBuktiKeuangan?.addEventListener('change', (e) => {
         const file = e.target.files[0];
         if(file) {
             const reader = new FileReader();
             reader.onload = (ev) => {
                 if(imgPreviewKeu) imgPreviewKeu.src = ev.target.result;
                 if(previewBuktiKeuangan) previewBuktiKeuangan.style.display = 'flex';
             };
             reader.readAsDataURL(file);
         }
     });

    async function recalculateTrxBalance(trxId) {
        if(!trxId) return;
        const { data: fins } = await supabase.from('keuangan').select('*').eq('related_trx_id', trxId);
        const total = (fins || []).reduce((s, f) => s + (parseFloat(f.nominal) || 0), 0);
        const history = (fins || []).map(f => ({
            payId: f.id,
            tgl: f.tanggal,
            nominal: parseFloat(f.nominal),
            channel: f.channel,
            buktiUrl: f.bukti_url
        }));
        await supabase.from('transaksi').update({ total_paid: Math.max(0, total), history_bayar: history }).eq('id', trxId);
    }
 
     btnRemoveKeuPhoto?.addEventListener('click', () => {
         if(inpBuktiKeuangan) inpBuktiKeuangan.value = '';
         if(previewBuktiKeuangan) previewBuktiKeuangan.style.display = 'none';
     });
 
     btnOpenCameraKeu?.addEventListener('click', () => {
         if(window.openCameraUI) {
             window.openCameraUI((file) => {
                 const dt = new DataTransfer();
                 dt.items.add(file);
                 if(inpBuktiKeuangan) {
                     inpBuktiKeuangan.files = dt.files;
                     inpBuktiKeuangan.dispatchEvent(new Event('change'));
                 }
             });
         }
     });

    document.getElementById('btnTambahPemasukan')?.addEventListener('click', () => {
        window.editingId = null;
        window.oldNominal = 0;
        window.oldTrxId = null;
        window.existingKeuBukti = null;
        formKeuangan.reset();
        tipeInput.value = 'pemasukan';
        modalTitle.textContent = 'Tambah Pemasukan';
        tanggalInput.value = window.getLocalDate();
        populateKategori('pemasukan');
        modalKeuangan.classList.add('active');
    });

    document.getElementById('btnTambahPengeluaran')?.addEventListener('click', () => {
        window.editingId = null;
        window.oldNominal = 0;
        window.oldTrxId = null;
        window.existingKeuBukti = null;
        formKeuangan.reset();
        tipeInput.value = 'pengeluaran';
        modalTitle.textContent = 'Catat Pengeluaran';
        tanggalInput.value = window.getLocalDate();
        populateKategori('pengeluaran');
        modalKeuangan.classList.add('active');
    });

    const isAuthorized = ['admin', 'office', 'staf', 'operator'].includes((window.CURRENT_USER?.role || '').toLowerCase().trim());
    if (isAuthorized) {
        // Target the action buttons container next to +Pemasukan
        const actionContainer = document.querySelector('.card-box .flex-between div:last-child');
        if (actionContainer && !document.getElementById('btnSyncKeuangan')) {
            const btnRepair = document.createElement('button');
            btnRepair.id = 'btnOpenRepair';
            btnRepair.className = 'btn';
            btnRepair.style.cssText = 'background:rgba(245,158,11,0.1); color:#f59e0b; border:1px solid rgba(245,158,11,0.2); margin-right: 0.5rem;';
            btnRepair.innerHTML = '🔧 Reparasi Data';
            btnRepair.onclick = () => document.getElementById('modalRepair').classList.add('active');
            actionContainer.prepend(btnRepair);

            const btnSync = document.createElement('button');
            btnSync.id = 'btnSyncKeuangan';
            btnSync.className = 'btn';
            btnSync.style.cssText = 'background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.2); margin-right: 0.5rem;';
            btnSync.innerHTML = '🔄 Sinkron Data';
            btnSync.onclick = handleSyncAll;
            actionContainer.prepend(btnSync);
        }
    }

    async function handleSyncAll() {
        window.showConfirm('Sinkronkan seluruh saldo transaksi dengan catatan keuangan? Ini akan memperbaiki data yang tidak sinkron seperti TRX00001.', async () => {
            window.showToast('Memulai sinkronisasi...', 'info');
            const { data: trxs } = await supabase.from('transaksi').select('id');
            const { data: fins } = await supabase.from('keuangan').select('*');
            
            let fixedCount = 0;
            for (const trx of (trxs || [])) {
                const related = (fins || []).filter(f => f.related_trx_id === trx.id);
                const total = related.reduce((s, f) => s + (parseFloat(f.nominal) || 0), 0);
                const history = related.map(f => ({
                    payId: f.id,
                    tgl: f.tanggal,
                    nominal: parseFloat(f.nominal),
                    channel: f.channel,
                    buktiUrl: f.bukti_url
                }));
                
                await supabase.from('transaksi').update({ 
                    total_paid: total, 
                    history_bayar: history 
                }).eq('id', trx.id);
                fixedCount++;
            }
            window.showAlert(`Sinkronisasi Selesai!<br>${fixedCount} transaksi telah diperbarui.`, 'success', () => window.location.reload());
        }, null, 'Sinkron Data', 'Mulai Sinkron', 'btn-primary');
    }

    document.querySelectorAll('.sort-header').forEach(h => {
        h.addEventListener('click', () => {
            currentSort.direction = (currentSort.column === h.dataset.column && currentSort.direction === 'asc') ? 'desc' : 'asc';
            currentSort.column = h.dataset.column;
            renderApp();
        });
    });

    document.getElementById('inpSearchKeuangan')?.addEventListener('input', renderApp);
    document.getElementById('btnCloseModal')?.addEventListener('click', () => modalKeuangan.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modalKeuangan.classList.remove('active'));

    // Repair Handlers
    const modalRepair = document.getElementById('modalRepair');
    document.getElementById('btnCloseModalRepair')?.addEventListener('click', () => modalRepair.classList.remove('active'));
    document.getElementById('btnCancelModalRepair')?.addEventListener('click', () => modalRepair.classList.remove('active'));
    document.getElementById('btnExecuteRepair')?.addEventListener('click', async () => {
        const trxId = document.getElementById('repairTrxId').value.trim();
        const talis = document.getElementById('repairNoTali').value.split(',').map(s => s.trim()).filter(s => s);
        const customerName = document.getElementById('repairCustomer').value.trim();
        const totalDeal = parseFloat(document.getElementById('repairTotalDeal').value) || 0;

        if(!trxId || talis.length === 0) return window.showAlert('ID TRX dan Nomor Tali wajib diisi!', 'danger');

        window.showConfirm(`Pulihkan ${trxId} dengan kambing tali ${talis.join(', ')}?`, async () => {
            const btn = document.getElementById('btnExecuteRepair');
            btn.disabled = true; btn.textContent = 'Memproses...';
            window.showToast('Memulai pemulihan...', 'info');
            
            try {
                // 1. Cari Kambing
                const { data: goatsData } = await supabase.from('stok_kambing').select('*').in('no_tali', talis);
                if(!goatsData || goatsData.length === 0) {
                    window.showAlert('Kambing tidak ditemukan! Cek nomor tali.', 'danger');
                    return;
                }

                // 2. Buat Items
                const items = goatsData.map(g => ({
                    goatId: g.id,
                    noTali: g.no_tali,
                    price: parseFloat(g.harga_kandang || 0),
                    saving: parseFloat(g.saving || 0)
                }));

                // 3. Upsert Transaksi
                const trxPayload = {
                    id: trxId,
                    tgl_trx: window.getLocalDate(),
                    customer: { nama: customerName, wa1: '', alamat: '' },
                    items: items,
                    total_deal: totalDeal,
                    total_paid: 0,
                    history_bayar: []
                };

                const { error: trxErr } = await supabase.from('transaksi').upsert([trxPayload]);
                if(trxErr) throw new Error(trxErr.message);

                // 4. Update status kambing
                for (const g of goatsData) {
                    await supabase.from('stok_kambing').update({ status_transaksi: 'Terjual', transaction_id: trxId }).eq('id', g.id);
                }

                // 5. Sinkron Saldo HANYA TRX ini saja (cepat & anti-hang)
                await recalculateTrxBalance(trxId);

                modalRepair.classList.remove('active');
                window.showAlert('✅ Transaksi Berhasil Dipulihkan!', 'success', () => window.location.reload());
            } catch (err) {
                window.showAlert('Gagal pemulihan: ' + err.message, 'danger');
            } finally {
                btn.disabled = false; btn.textContent = '🚀 Pulihkan Data';
            }
        }, null, 'Konfirmasi Pemulihan', 'Proses Sekarang', 'btn-primary');
    });

    async function populateKategori(tipe) {
        if(!kategoriInput) return;
        kategoriInput.innerHTML = '';
        const katIn = ['Modal Awal','Terima Pelunasan','Penjualan Sapi','Jual Kambing','Kompensasi Supplier','Penerimaan Lainnya'];
        const katOut = ['Beli Kambing','Beban Pakan','Beban Operasional Kandang','Gaji & Bonus','Listrik & Air','Transportasi','Marketing / Iklan','Bayar Supplier','Pelunasan Supplier','Bagi Hasil (Investor)','Prive / Tarik Tunai','Biaya Lain-lain','Kerugian (Mati/Hilang)'];
        const list = tipe === 'pemasukan' ? katIn : katOut;
        list.forEach(k => {
            const o = document.createElement('option'); o.value = k; o.textContent = k;
            kategoriInput.appendChild(o);
        });
    }

    await renderApp();
});
