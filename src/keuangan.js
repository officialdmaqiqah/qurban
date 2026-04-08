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
                             <button class="btn btn-sm btn-view-photo" data-url="${item.bukti_url}" style="width:30px; height:30px; border-radius:4px; padding:0; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
                                 <img src="${item.bukti_url}" style="width:100%; height:100%; object-fit:cover;">
                             </button>
                         ` : '<span style="opacity:0.2">🚫</span>'}
                     </td>
                     <td style="white-space:nowrap;">
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

        document.querySelectorAll('.btn-delete-action').forEach(btn => btn.onclick = () => handleDelete(btn.dataset.id));
         
         document.querySelectorAll('.btn-view-photo').forEach(btn => {
             btn.onclick = (e) => {
                 e.stopPropagation();
                 const url = btn.dataset.url;
                 const modal = document.getElementById('photoLightbox');
                 const img = document.getElementById('lightboxImg');
                 if(modal && img) {
                    img.src = url;
                    modal.style.display = 'flex';
                 }
             };
         });
    }

    async function handleDelete(id) {
        const { data: item } = await supabase.from('keuangan').select('*').eq('id', id).single();
        if(!item) return;
        
        window.showConfirm(`Hapus transaksi ${id}?`, async () => {
            if(item.related_trx_id) {
                const { data: trx } = await supabase.from('transaksi').select('*').eq('id', item.related_trx_id).single();
                if(trx) {
                    const updatedPaid = (trx.totalPaid || 0) - (parseFloat(item.nominal) || 0);
                    const updatedHistory = (trx.historyBayar || []).filter(h => h.payId !== id);
                    await supabase.from('transaksi').update({ totalPaid: updatedPaid, historyBayar: updatedHistory }).eq('id', item.related_trx_id);
                }
            }
            await supabase.from('keuangan').delete().eq('id', id);
            await renderApp();
            if(window.showToast) window.showToast('Berhasil dihapus', 'success');
        }, null, 'Hapus Transaksi', 'Ya, Hapus', 'btn-danger');
    }

    const handleSave = async (e) => {
        e.preventDefault();
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
            if(!await checkSaldoCukup(finalChannel, nominal, finalChannel)) return;
        }

        let buktiUrl = null;
        if(inpBuktiKeuangan && inpBuktiKeuangan.files.length > 0) {
            window.showToast('Mengompres & Mengunggah bukti...', 'info');
            const b64 = await compressImage(inpBuktiKeuangan.files[0]);
            buktiUrl = await uploadToGDrive(b64, "BUKTI_KEUANGAN");
        }

        const id = 'FIN-' + Date.now().toString().slice(-6);
        const { error } = await supabase.from('keuangan').insert([{
            id, tipe, tanggal: tgl, kategori: kat, nominal, keterangan: ket, channel: finalChannel, bukti_url: buktiUrl
        }]);

        if(!error) {
            window.showToast('Data berhasil disimpan!', 'success');
            modalKeuangan.classList.remove('active');
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
        formKeuangan.reset();
        tipeInput.value = 'pemasukan';
        modalTitle.textContent = 'Tambah Pemasukan';
        tanggalInput.value = window.getLocalDate();
        modalKeuangan.classList.add('active');
    });

    document.getElementById('btnTambahPengeluaran')?.addEventListener('click', () => {
        formKeuangan.reset();
        tipeInput.value = 'pengeluaran';
        modalTitle.textContent = 'Catat Pengeluaran';
        tanggalInput.value = window.getLocalDate();
        modalKeuangan.classList.add('active');
    });

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

    await renderApp();
});
