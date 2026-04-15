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

    // DB Helpers
    let officialKatIn = [];
    let officialKatOut = [];

    const loadAndSyncCategories = async () => {
        try {
            // 1. Fetch from master_data
            const { data: catIn } = await supabase.from('master_data').select('val').eq('key', 'KAT_KEU_IN').single();
            const { data: catOut } = await supabase.from('master_data').select('val').eq('key', 'KAT_KEU_OUT').single();

            // 2. Default hardcoded lists (sebagai fallback & basis awal)
            const defIn = ['Modal Awal','Terima Pelunasan','Penjualan Sapi','Jual Kambing','Kompensasi Supplier','Penerimaan Lainnya'];
            const defOut = ['Beli Kambing','Beban Pakan','Beban Operasional Kandang','Gaji & Bonus','Listrik & Air','Transportasi','Marketing / Iklan','Bayar Supplier','Pelunasan Supplier','Bagi Hasil (Investor)','Prive / Tarik Tunai','Biaya Lain-lain','Kerugian (Mati/Hilang)'];

            if (!catIn || !catOut) {
                // MIGRASI PERTAMA: Scan tabel keuangan untuk kategori unik
                console.log('[Migration] Memulai migrasi kategori dari riwayat transaksi...');
                const { data: rows } = await supabase.from('keuangan').select('kategori, tipe');
                
                const uniqueIn = rows ? [...new Set(rows.filter(x => x.tipe === 'pemasukan').map(x => x.kategori))].filter(Boolean) : [];
                const uniqueOut = rows ? [...new Set(rows.filter(x => x.tipe === 'pengeluaran').map(x => x.kategori))].filter(Boolean) : [];

                officialKatIn = [...new Set([...defIn, ...uniqueIn])].filter(x => x !== 'Lainnya (Tulis Sendiri)');
                officialKatOut = [...new Set([...defOut, ...uniqueOut])].filter(x => x !== 'Lainnya (Tulis Sendiri)');

                // Simpan ke database
                await supabase.from('master_data').upsert([
                    { id: 'ID-KAT-KEU-IN', key: 'KAT_KEU_IN', val: officialKatIn },
                    { id: 'ID-KAT-KEU-OUT', key: 'KAT_KEU_OUT', val: officialKatOut }
                ], { onConflict: 'key' });
                console.log('[Migration] Kategori berhasil dimigrasi.');
            } else {
                officialKatIn = catIn.val;
                officialKatOut = catOut.val;
            }
        } catch (e) {
            console.error("Error categories sync:", e);
        }
    };

    // --- PHOTO UTILITIES (Global Scope) ---
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

    const getKeuanganData = async () => {
        const { data, error } = await supabase.from('keuangan').select('*');
        if(error) { console.error("Error fetching keuangan:", error); return []; }
        return data || [];
    };

    const getTransaksiMap = async () => {
        const { data, error } = await supabase.from('transaksi').select('id, customer, agen');
        if(error) return {};
        const map = {};
        (data || []).forEach(t => map[t.id] = t);
        return map;
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
        const [data, trxMap] = await Promise.all([getKeuanganData(), getTransaksiMap()]);
        if(tableBody) tableBody.innerHTML = '';
        
        // ── Populate filter dropdowns dynamically ────────────────────
        const filterChannel = document.getElementById('filterChannel');
        const filterKategori = document.getElementById('filterKategori');
        const filterTipe = document.getElementById('filterTipe');

        const prevChannel = filterChannel ? filterChannel.value : '';
        const prevKategori = filterKategori ? filterKategori.value : '';
        const prevTipe = filterTipe ? filterTipe.value : '';

        // Collect unique channels & categories from all data
        const uniqueChannels = [...new Set(data.map(d => {
            let ch = d.channel || 'Tunai / Cash';
            if(['Cash','Tunai','-','Tunai/Lainnya'].includes(ch)) ch = 'Tunai / Cash';
            return ch;
        }))].sort();
        const uniqueKategori = [...new Set(data.map(d => d.kategori).filter(Boolean))].sort();

        if(filterChannel) {
            filterChannel.innerHTML = '<option value="">Semua Channel</option>';
            uniqueChannels.forEach(ch => {
                const o = document.createElement('option'); o.value = ch; o.textContent = ch;
                filterChannel.appendChild(o);
            });
            filterChannel.value = prevChannel; // restore selection
        }
        if(filterKategori) {
            filterKategori.innerHTML = '<option value="">Semua Kategori</option>';
            uniqueKategori.forEach(k => {
                const o = document.createElement('option'); o.value = k; o.textContent = k;
                filterKategori.appendChild(o);
            });
            filterKategori.value = prevKategori;
        }

        // ── Map transaksi ────────────────────────────────────────────
        let processed = data.map(item => ({
            ...item,
            transaksi: item.related_trx_id ? trxMap[item.related_trx_id] : null
        }));

        // ── FILTERS ──────────────────────────────────────────────────
        // 1. Tipe filter
        if (prevTipe) {
            processed = processed.filter(item => item.tipe === prevTipe);
        }

        // 2. Channel filter
        if (prevChannel) {
            processed = processed.filter(item => {
                let ch = item.channel || 'Tunai / Cash';
                if(['Cash','Tunai','-','Tunai/Lainnya'].includes(ch)) ch = 'Tunai / Cash';
                return ch === prevChannel;
            });
        }

        // 3. Kategori filter
        if (prevKategori) {
            processed = processed.filter(item => item.kategori === prevKategori);
        }

        // 4. Search Filter
        const searchInput = document.getElementById('inpSearchKeuangan');
        const searchKeyword = (searchInput ? searchInput.value : '').toLowerCase();
        if (searchKeyword) {
            processed = processed.filter(item => 
                (item.id || '').toLowerCase().includes(searchKeyword) ||
                (item.kategori || '').toLowerCase().includes(searchKeyword) ||
                (item.keterangan || '').toLowerCase().includes(searchKeyword) ||
                (item.channel || '').toLowerCase().includes(searchKeyword) ||
                (item.transaksi?.customer?.nama || '').toLowerCase().includes(searchKeyword) ||
                (item.transaksi?.agen?.nama || '').toLowerCase().includes(searchKeyword)
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


        const isVisible = processed.length > 0;
        if(tableBody) {
            tableBody.closest('table').style.display = isVisible ? 'table' : 'none';
            if(emptyState) emptyState.style.display = isVisible ? 'none' : 'block';
        }

        // ── Hitung saldo per channel (dari SEMUA data, bukan filtered) ──
        let balances = { 'Tunai / Cash': 0 };
        let inByChannel = { 'Tunai / Cash': 0 };
        let outByChannel = { 'Tunai / Cash': 0 };
        const rekenings = await getBankAccounts();
        rekenings.forEach(acc => { 
            const k = `TF ${acc.bank} - ${acc.norek} (${acc.an})`;
            balances[k] = 0; inByChannel[k] = 0; outByChannel[k] = 0; 
        });

        data.forEach(item => {
            const channelRaw = item.channel || 'Tunai / Cash';
            let channelName = channelRaw;
            if(['Cash', 'Tunai', 'Tunai / Cash', '-', 'Tunai/Lainnya'].includes(channelName)) channelName = 'Tunai / Cash';
            if(!balances.hasOwnProperty(channelName)) {
                balances[channelName] = 0;
                inByChannel[channelName] = 0;
                outByChannel[channelName] = 0;
            }
            const nom = parseFloat(item.nominal) || 0;
            if (item.tipe === 'pemasukan') {
                balances[channelName] += nom;
                inByChannel[channelName] += nom;
            }
            if (item.tipe === 'pengeluaran') {
                balances[channelName] -= nom;
                outByChannel[channelName] += nom;
            }
        });

        // ── Hitung total pemasukan/pengeluaran dari DATA YANG DIFILTER ──
        const hasFilter = prevTipe || prevChannel || prevKategori || searchKeyword;
        processed.forEach(item => {
            const channelRaw = item.channel || 'Tunai / Cash';
            let channelName = channelRaw;
            if(['Cash', 'Tunai', 'Tunai / Cash', '-', 'Tunai/Lainnya'].includes(channelName)) channelName = 'Tunai / Cash';
            const isNonKas = channelName.toLowerCase().includes('non-kas') || channelName.toLowerCase().includes('lainnya');
            if (!isNonKas) {
                if (item.tipe === 'pemasukan') inTotal += (parseFloat(item.nominal) || 0);
                if (item.tipe === 'pengeluaran') outTotal += (parseFloat(item.nominal) || 0);
            }
        });

        const isRestrictedFinance = typeof window.isRestricted === 'function' ? window.isRestricted('hideKeuangan') : false;

        if(tableBody && isVisible) {
            processed.forEach((item) => {
                const isIncome = item.tipe === 'pemasukan';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td data-label="ID" style="font-size:0.7rem; color:var(--text-muted)">${item.id || '-'}</td>
                    <td data-label="TANGGAL">${formatDate(item.tanggal)}</td>
                    <td data-label="KONSUMEN" style="font-size:0.85rem;">${item.transaksi?.customer?.nama || '<span style="opacity:0.3">-</span>'}</td>
                    <td data-label="AGEN" style="font-size:0.85rem;">${item.transaksi?.agen?.nama || '<span style="opacity:0.3">-</span>'}</td>
                    <td data-label="KATEGORI"><span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">${item.kategori}</span></td>
                    <td data-label="KETERANGAN" style="font-size:0.85rem;">${item.keterangan || '-'}</td>
                    <td data-label="NOMINAL" style="color: ${isIncome ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                        ${isRestrictedFinance ? '***' : (isIncome ? '+' : '-') + ' ' + formatRp(item.nominal)}
                    </td>
                    <td data-label="TIPE" style="font-size:0.8rem; text-transform:capitalize;">${item.tipe}</td>
                    <td data-label="CHANNEL" style="font-size:0.8rem; color:var(--text-muted)">${item.channel || '-'}</td>
                     <td data-label="PHOTO" style="text-align:center;">
                         ${item.bukti_url ? `
                             <button class="btn btn-sm" onclick="window.viewPhoto('${item.bukti_url}')" style="width:30px; height:30px; border-radius:4px; padding:0; overflow:hidden; border:1px solid rgba(255,255,255,0.1); cursor:pointer;">
                                 <img src="${window.getDirectDriveLink(item.bukti_url)}" style="width:100%; height:100%; object-fit:cover; pointer-events:none;">
                             </button>
                         ` : '<span style="opacity:0.2">🚫</span>'}
                     </td>
                     <td data-label="AKSI" style="white-space:nowrap;">
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

            // Sort logic as requested: 1. Kas Operasional, 2. Tunai, 3. Mandiri, 4. BSI, others
            const sortedEntries = Object.entries(balances).sort(([nameA], [nameB]) => {
                const getPriority = (name) => {
                    const low = name.toLowerCase();
                    if(low === 'kas operasional') return 1;
                    if(low.includes('tunai') || low.includes('cash')) return 2;
                    if(low.includes('mandiri')) return 3;
                    if(low.includes('bsi')) return 4;
                    return 99;
                };
                return getPriority(nameA) - getPriority(nameB);
            });

            for (const [chan, val] of sortedEntries) {
                if(chan.toLowerCase().includes('non-kas') && val === 0) continue;
                const isBank = chan.toLowerCase().includes('tf ') || chan.toLowerCase().includes('bank');
                const isKasOps = chan === 'Kas Operasional';
                
                // Clean label: Bank Mandiri - 1690004605256 (Husni Thamrin) -> Bank Mandiri - 1690004605256
                let label = chan.replace('TF ', 'Bank ');
                if (label.includes('(')) {
                    label = label.split(' (')[0];
                }

                const isHighlighted = prevChannel && chan === prevChannel;
                
                const inVal = inByChannel[chan] || 0;
                const outVal = outByChannel[chan] || 0;

                containerBalance.innerHTML += `
                <div class="balance-card ${isHighlighted ? 'active-filter' : ''}">
                    <div class="balance-info">
                        <div class="balance-label">${label.toUpperCase()}</div>
                        <div class="balance-value" style="color:${val < 0 ? 'var(--danger)' : 'var(--success)'}">
                            ${isRestrictedFinance ? '********' : formatRp(val)}
                        </div>
                        <div class="balance-subinfo">
                            <span style="color:var(--success)">⬇️ ${formatRp(inVal)}</span>
                            <span style="color:var(--danger)">⬆️ ${formatRp(outVal)}</span>
                        </div>
                    </div>
                </div>`;
            }
        }

        // Summary header — show filter badge when active
        const filterLabel = hasFilter ? ` <span style="font-size:0.7rem; background:rgba(99,102,241,0.15); color:#6366f1; padding:2px 8px; border-radius:20px; margin-left:6px;">Filter: ${processed.length} data</span>` : '';
        if(totalPemasukanEl) totalPemasukanEl.innerHTML = (isRestrictedFinance ? '********' : formatRp(inTotal)) + (hasFilter && !isRestrictedFinance ? filterLabel : '');
        if(totalPengeluaranEl) totalPengeluaranEl.innerHTML = (isRestrictedFinance ? '********' : formatRp(outTotal)) + (hasFilter && !isRestrictedFinance ? filterLabel : '');

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
        } else if (chan === 'Kas Operasional') {
            transaksiChannel.value = 'Kas Operasional';
            containerTransaksiRek.style.display = 'none';
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
        const btnSave = e.submitter || document.querySelector('#formKeuangan button[type="submit"]');
        const originalText = btnSave ? btnSave.innerHTML : 'Simpan';
        
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.style.opacity = '0.7';
            btnSave.innerText = 'Mengunggah...';
        }

        try {
            const id = window.editingId || ('FIN-' + Date.now().toString().slice(-6));
            const tipe = tipeInput.value;
            const nominal = window.parseNum(nominalInput.value);
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
                if (btnSave) btnSave.innerText = 'Menyimpan Foto...';
                window.showToast('Mengompres & Mengunggah bukti...', 'info');
                const b64 = await compressImage(inpBuktiKeuangan.files[0]);
                buktiUrl = await uploadToGDrive(b64, "BUKTI_KEUANGAN");
                if (btnSave) btnSave.innerText = 'Menyimpan Data...';
            }

            let finalKat = kat;
            if(kat === 'Lainnya (Tulis Sendiri)') {
                finalKat = kategoriLainInput.value.trim();
                if(!finalKat) return window.showAlert('Tuliskan nama kategori baru!', 'warning');

                // AUTO-REGISTER CATEGORY
                const list = tipe === 'pemasukan' ? officialKatIn : officialKatOut;
                if (!list.includes(finalKat)) {
                    list.push(finalKat);
                    const key = tipe === 'pemasukan' ? 'KAT_KEU_IN' : 'KAT_KEU_OUT';
                    await supabase.from('master_data').upsert({ id: 'ID-' + key, key, val: list }, { onConflict: 'key' });
                    console.log(`[Category] New category registered: ${finalKat}`);
                }
            }

            if(tipe === 'mutasi') {
                const dest = transaksiMutasiTujuan.value;
                let destChannel = dest;
                if(dest === 'Tunai') destChannel = 'Tunai / Cash';
                else if(dest === 'Kas Operasional') destChannel = 'Kas Operasional';
                else {
                    const opt = transaksiMutasiTujuan.options[transaksiMutasiTujuan.selectedIndex];
                    destChannel = opt.textContent;
                }

                if(finalChannel === destChannel) return window.showAlert('Sumber dan Tujuan tidak boleh sama!', 'warning');
                
                window.showToast('Memproses Mutasi...', 'info');
                const mutasiId = 'MUT-' + Date.now().toString().slice(-6);
                
                // 1. Record Pengeluaran (Out)
                const pOut = {
                    id: mutasiId + '-OUT', tipe: 'pengeluaran', tanggal: tgl,
                    kategori: 'Mutasi Antar Rekening', nominal, keterangan: `Transfer ke ${destChannel} | ${ket}`,
                    channel: finalChannel, bukti_url: buktiUrl
                };
                
                // 2. Record Pemasukan (In)
                const pIn = {
                    id: mutasiId + '-IN', tipe: 'pemasukan', tanggal: tgl,
                    kategori: 'Mutasi Antar Rekening', nominal, keterangan: `Terima dari ${finalChannel} | ${ket}`,
                    channel: destChannel, bukti_url: buktiUrl
                };

                const { error: err1 } = await supabase.from('keuangan').insert([pOut]);
                const { error: err2 } = await supabase.from('keuangan').insert([pIn]);

                if(!err1 && !err2) {
                    window.showToast('Mutasi Saldo Berhasil!', 'success');
                    modalKeuangan.classList.remove('active');
                    renderApp();
                    return;
                } else {
                    return window.showAlert('Gagal mutasi: ' + (err1?.message || err2?.message), 'danger');
                }
            }

            const payload = {
                id, tipe, tanggal: tgl, kategori: finalKat, nominal, keterangan: ket, channel: finalChannel, bukti_url: buktiUrl
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
        } catch (err) {
            console.error('Unhandled Error during save:', err);
            window.showAlert('Terjadi kesalahan tidak terduga: ' + err.message, 'danger');
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.style.opacity = '1';
                btnSave.innerHTML = originalText;
            }
        }
    };

    // Inisialisasi Masker Uang
    window.setupMoneyMask('transaksiNominal');
    window.setupMoneyMask('repairTotalDeal');

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

    document.getElementById('btnTambahPengeluaran')?.addEventListener('click', () => {
        window.editingId = null;
        window.oldNominal = 0;
        window.oldTrxId = null;
        window.existingKeuBukti = null;
        formKeuangan.reset();
        
        containerKategori.style.display = 'block';
        containerKategoriLain.style.display = 'none';
        containerMutasiTujuan.style.display = 'none';
        const lblSumber = document.querySelector('#containerTransaksiRek .form-label');
        if(lblSumber) lblSumber.textContent = 'Pilih Rekening';

        tipeInput.value = 'pengeluaran';
        modalTitle.textContent = 'Catat Pengeluaran';
        tanggalInput.value = window.getLocalDate();
        populateKategori('pengeluaran');
        modalKeuangan.classList.add('active');
    });

    document.getElementById('btnTambahMutasi')?.addEventListener('click', async () => {
        window.editingId = null;
        window.oldNominal = 0;
        window.oldTrxId = null;
        window.existingKeuBukti = null;
        formKeuangan.reset();
        
        tipeInput.value = 'mutasi';
        modalTitle.textContent = '⇄ Mutasi Antar Rekening';
        tanggalInput.value = window.getLocalDate();
        
        containerKategori.style.display = 'none';
        containerKategoriLain.style.display = 'none';
        containerMutasiTujuan.style.display = 'block';
        
        const lblSumber = document.querySelector('#containerTransaksiRek .form-label');
        if(lblSumber) lblSumber.textContent = 'Dari (Sumber)';
        
        transaksiChannel.value = 'Tunai';
        containerTransaksiRek.style.display = 'none';
        
        // Populate Tujuan
        transaksiMutasiTujuan.innerHTML = '<option value="Tunai">💵 Tunai / Cash</option><option value="Kas Operasional">🏷️ Kas Operasional</option>';
        const reks = await getBankAccounts();
        reks.forEach(r => {
            const o = document.createElement('option');
            o.value = r.id; o.textContent = `TF ${r.bank} - ${r.norek} (${r.an})`;
            transaksiMutasiTujuan.appendChild(o);
        });

        modalKeuangan.classList.add('active');
    });

    kategoriInput?.addEventListener('change', () => {
        if(kategoriInput.value === 'Lainnya (Tulis Sendiri)') {
            containerKategoriLain.style.display = 'block';
        } else {
            containerKategoriLain.style.display = 'none';
        }
    });

    document.getElementById('btnTambahPemasukan')?.addEventListener('click', () => {
        window.editingId = null;
        window.oldNominal = 0;
        window.oldTrxId = null;
        window.existingKeuBukti = null;
        formKeuangan.reset();

        containerKategori.style.display = 'block';
        containerKategoriLain.style.display = 'none';
        containerMutasiTujuan.style.display = 'none';
        const lblSumber = document.querySelector('#containerTransaksiRek .form-label');
        if(lblSumber) lblSumber.textContent = 'Pilih Rekening';

        tipeInput.value = 'pemasukan';
        modalTitle.textContent = 'Tambah Pemasukan';
        tanggalInput.value = window.getLocalDate();
        populateKategori('pemasukan');
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
    document.getElementById('filterTipe')?.addEventListener('change', renderApp);
    document.getElementById('filterChannel')?.addEventListener('change', renderApp);
    document.getElementById('filterKategori')?.addEventListener('change', renderApp);
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
        const totalDeal = window.parseNum(document.getElementById('repairTotalDeal').value) || 0;

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
        const list = [...(tipe === 'pemasukan' ? officialKatIn : officialKatOut), 'Lainnya (Tulis Sendiri)'];
        list.forEach(k => {
            const o = document.createElement('option'); o.value = k; o.textContent = k;
            kategoriInput.appendChild(o);
        });
    }

    // ============================================================
    // EXPORT EXCEL
    // ============================================================
    async function handleExport() {
        const btn = document.getElementById('btnExportKeuangan');
        if(btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }

        try {
            window.showToast('Mengambil data untuk export...', 'info');

            // 1. Ambil semua data keuangan
            const { data: keuData } = await supabase.from('keuangan').select('*').order('tanggal', { ascending: false });
            if(!keuData || keuData.length === 0) {
                window.showAlert('Tidak ada data untuk di-export.', 'warning');
                return;
            }

            // 2. Ambil semua transaksi (penjualan kambing) yang terkait
            const relatedTrxIds = [...new Set(keuData.map(k => k.related_trx_id).filter(Boolean))];
            let trxMap = {};
            if(relatedTrxIds.length > 0) {
                const { data: trxData } = await supabase.from('transaksi').select('*').in('id', relatedTrxIds);
                (trxData || []).forEach(t => trxMap[t.id] = t);
            }

            // 3. Ambil data agen dari master_data
            const { data: agenMaster } = await supabase.from('master_data').select('val').eq('key', 'AGENS').single();
            const allAgens = agenMaster?.val || [];
            const agenMap = {};
            allAgens.forEach(a => agenMap[a.nama] = a);

            // 4. Ambil semua kambing yang terkait (goatIds dari items transaksi)
            const allGoatIds = [];
            Object.values(trxMap).forEach(t => {
                (t.items || []).forEach(item => { if(item.goatId) allGoatIds.push(item.goatId); });
            });
            let kambingMap = {};
            if(allGoatIds.length > 0) {
                const { data: kambingData } = await supabase.from('stok_kambing').select('*').in('id', allGoatIds);
                (kambingData || []).forEach(k => kambingMap[k.id] = k);
            }

            // ── SHEET 1: Semua Transaksi ─────────────────────────────────
            const sheet1Rows = keuData.map(item => {
                const trx = item.related_trx_id ? trxMap[item.related_trx_id] : null;
                const agenNama = trx?.agen?.nama || '';
                const agenInfo = agenNama ? agenMap[agenNama] : null;

                return {
                    'ID Keuangan':      item.id || '',
                    'Tanggal':          item.tanggal || '',
                    'Tipe':             item.tipe ? item.tipe.toUpperCase() : '',
                    'Kategori':         item.kategori || '',
                    'Keterangan':       item.keterangan || '',
                    'Nominal (Rp)':     parseFloat(item.nominal) || 0,
                    'Channel':          item.channel || 'Tunai',
                    'Nama Konsumen':    trx?.customer?.nama || '',
                    'WA Konsumen':      trx?.customer?.wa1 || '',
                    'Nama Marketing':   agenNama,
                    'Jenis Marketing':  trx?.agen?.tipe || agenInfo?.jenis || '',
                    'WA Marketing':     agenInfo?.wa || '',
                    'ID Transaksi':     item.related_trx_id || '',
                    'Bukti Foto URL':   item.bukti_url || '',
                };
            });

            // ── SHEET 2: Detail Penjualan Kambing ────────────────────────
            // Satu baris per kambing per transaksi (dengan info marketing & bayar)
            const sheet2Rows = [];
            for(const item of keuData) {
                if(!item.related_trx_id) continue;
                const trx = trxMap[item.related_trx_id];
                if(!trx) continue;

                const agenNama = trx.agen?.nama || '';
                const agenInfo = agenNama ? agenMap[agenNama] : null;
                const items = trx.items || [];

                if(items.length === 0) {
                    // Transaksi tanpa item (edge case)
                    sheet2Rows.push({
                        'ID Keuangan':        item.id || '',
                        'Tanggal Bayar':      item.tanggal || '',
                        'Jenis Bayaran':      item.kategori || '',
                        'Nominal Bayar (Rp)': parseFloat(item.nominal) || 0,
                        'Channel Bayar':      item.channel || 'Tunai',
                        'ID Transaksi':       trx.id || '',
                        'Tanggal Order':      trx.tgl_trx || '',
                        'Total Deal (Rp)':    parseFloat(trx.total_deal) || 0,
                        'Total Bayar (Rp)':   parseFloat(trx.total_paid) || 0,
                        'Sisa (Rp)':          (parseFloat(trx.total_deal) || 0) - (parseFloat(trx.total_paid) || 0),
                        // Konsumen
                        'Nama Konsumen':      trx.customer?.nama || '',
                        'WA Konsumen':        trx.customer?.wa1 || '',
                        'Alamat Kabupaten':   trx.customer?.alamat?.kab || '',
                        'Alamat Kecamatan':   trx.customer?.alamat?.kec || '',
                        'Alamat Desa':        trx.customer?.alamat?.desa || '',
                        'Alamat Jalan':       trx.customer?.alamat?.jalan || '',
                        'Maps Link':          trx.customer?.alamat?.maps || '',
                        // Marketing / Agen
                        'Nama Marketing':     agenNama,
                        'Jenis Marketing':    trx.agen?.tipe || agenInfo?.jenis || '',
                        'WA Marketing':       agenInfo?.wa || '',
                        'Komisi Marketing (Rp)': trx.komisi?.nominal || 0,
                        'Status Komisi':      trx.komisi?.status || '',
                        // Delivery
                        'Tipe Delivery':      trx.delivery?.tipe || '',
                        'Tgl Delivery':       trx.delivery?.tgl || '',
                        // Kambing
                        'No Tali':            '',
                        'Batch/Kiriman':      '',
                        'Warna Tali':         '',
                        'Nama Sohibul':       '',
                        'Jenis Kelamin':      '',
                        'Berat (Kg)':         '',
                        'Harga Kandang (Rp)': '',
                        'Harga Deal (Rp)':    '',
                        'Status Kesehatan':   '',
                        'Catatan Kambing':    '',
                    });
                } else {
                    // Satu baris per kambing
                    for(const it of items) {
                        const mb = kambingMap[it.goatId] || {};
                        sheet2Rows.push({
                            'ID Keuangan':        item.id || '',
                            'Tanggal Bayar':      item.tanggal || '',
                            'Jenis Bayaran':      item.kategori || '',
                            'Nominal Bayar (Rp)': parseFloat(item.nominal) || 0,
                            'Channel Bayar':      item.channel || 'Tunai',
                            'ID Transaksi':       trx.id || '',
                            'Tanggal Order':      trx.tgl_trx || '',
                            'Total Deal (Rp)':    parseFloat(trx.total_deal) || 0,
                            'Total Bayar (Rp)':   parseFloat(trx.total_paid) || 0,
                            'Sisa (Rp)':          (parseFloat(trx.total_deal) || 0) - (parseFloat(trx.total_paid) || 0),
                            // Konsumen
                            'Nama Konsumen':      trx.customer?.nama || '',
                            'WA Konsumen':        trx.customer?.wa1 || '',
                            'Alamat Kabupaten':   trx.customer?.alamat?.kab || '',
                            'Alamat Kecamatan':   trx.customer?.alamat?.kec || '',
                            'Alamat Desa':        trx.customer?.alamat?.desa || '',
                            'Alamat Jalan':       trx.customer?.alamat?.jalan || '',
                            'Maps Link':          trx.customer?.alamat?.maps || '',
                            // Marketing / Agen
                            'Nama Marketing':     agenNama,
                            'Jenis Marketing':    trx.agen?.tipe || agenInfo?.jenis || '',
                            'WA Marketing':       agenInfo?.wa || '',
                            'Komisi Marketing (Rp)': trx.komisi?.nominal || 0,
                            'Status Komisi':      trx.komisi?.status || '',
                            // Delivery
                            'Tipe Delivery':      trx.delivery?.tipe || '',
                            'Tgl Delivery':       trx.delivery?.tgl || '',
                            // Kambing
                            'No Tali':            it.noTali || mb.no_tali || '',
                            'Batch/Kiriman':      it.batch || mb.batch || '',
                            'Warna Tali':         it.warnaTali || mb.warna_tali || '',
                            'Nama Sohibul':       it.namaSohibul || '',
                            'Jenis Kelamin':      mb.jenis_kelamin || '',
                            'Berat (Kg)':         mb.berat_kg || '',
                            'Harga Kandang (Rp)': parseFloat(it.hargaKandang || mb.harga_kandang) || 0,
                            'Harga Deal (Rp)':    parseFloat(it.hargaDeal) || 0,
                            'Status Kesehatan':   mb.status_kesehatan || '',
                            'Catatan Kambing':    mb.catatan || '',
                        });
                    }
                }
            }

            // ── BUILD WORKBOOK ───────────────────────────────────────────
            const wb = XLSX.utils.book_new();

            // Sheet 1
            const ws1 = XLSX.utils.json_to_sheet(sheet1Rows);
            // Set column widths sheet 1
            ws1['!cols'] = [
                {wch:16},{wch:12},{wch:13},{wch:22},{wch:35},{wch:18},{wch:20},
                {wch:22},{wch:16},{wch:22},{wch:20},{wch:16},{wch:14},{wch:40}
            ];
            XLSX.utils.book_append_sheet(wb, ws1, 'Semua Transaksi');

            // Sheet 2
            if(sheet2Rows.length > 0) {
                const ws2 = XLSX.utils.json_to_sheet(sheet2Rows);
                ws2['!cols'] = [
                    {wch:16},{wch:12},{wch:20},{wch:18},{wch:16},{wch:14},{wch:12},
                    {wch:18},{wch:18},{wch:14},{wch:22},{wch:16},{wch:20},{wch:20},
                    {wch:16},{wch:30},{wch:35},{wch:22},{wch:20},{wch:16},{wch:20},
                    {wch:18},{wch:16},{wch:14},{wch:14},{wch:14},{wch:16},{wch:12},
                    {wch:10},{wch:18},{wch:16},{wch:18},{wch:30}
                ];
                XLSX.utils.book_append_sheet(wb, ws2, 'Detail Penjualan Kambing');
            }

            // ── DOWNLOAD ─────────────────────────────────────────────────
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
            const fileName = `Keuangan_Qurban_${dateStr}.xlsx`;
            XLSX.writeFile(wb, fileName);

            window.showToast(`✅ Export berhasil! File: ${fileName}`, 'success');

        } catch(err) {
            console.error('Export error:', err);
            window.showAlert('Gagal export: ' + err.message, 'danger');
        } finally {
            if(btn) { btn.disabled = false; btn.innerHTML = '📥 Export Excel'; }
        }
    }

    document.getElementById('btnExportKeuangan')?.addEventListener('click', handleExport);

    // ============================================================

    await loadAndSyncCategories();

    await renderApp();
});

