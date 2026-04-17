import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
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

        const renderApp = async () => {
            try {
                let inTotal = 0, outTotal = 0;
                const [data, trxMap] = await Promise.all([getKeuanganData(), getTransaksiMap()]);
                if(tableBody) tableBody.innerHTML = '';
                
                const filterChannel = document.getElementById('filterChannel');
                const filterKategori = document.getElementById('filterKategori');
                const filterTipe = document.getElementById('filterTipe');
                const searchInput = document.getElementById('inpSearchKeuangan');

                // Dynamic Filters
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

                // Process Transactions
                let processed = data.map(item => ({ ...item, transaksi: item.related_trx_id ? trxMap[item.related_trx_id] : null }));
                if (filterTipe?.value) processed = processed.filter(item => item.tipe === filterTipe.value);
                if (filterChannel?.value) {
                    processed = processed.filter(item => {
                        let ch = item.channel || 'Tunai / Cash';
                        if(['Cash','Tunai','-','Tunai/Lainnya'].includes(ch)) ch = 'Tunai / Cash';
                        return ch === filterChannel.value;
                    });
                }
                if (filterKategori?.value) processed = processed.filter(item => item.kategori === filterKategori.value);
                
                const searchKeyword = (searchInput?.value || '').toLowerCase();
                if (searchKeyword) {
                    processed = processed.filter(item => 
                        (item.id || '').toLowerCase().includes(searchKeyword) ||
                        (item.kategori || '').toLowerCase().includes(searchKeyword) ||
                        (item.keterangan || '').toLowerCase().includes(searchKeyword) ||
                        (item.transaksi?.customer?.nama || '').toLowerCase().includes(searchKeyword) ||
                        (item.transaksi?.agen?.nama || '').toLowerCase().includes(searchKeyword)
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
                            <td data-label="KONSUMEN" style="font-size:0.85rem;">${item.transaksi?.customer?.nama || '<span style="opacity:0.3">-</span>'}</td>
                            <td data-label="AGEN" style="font-size:0.85rem;">${item.transaksi?.agen?.nama || '<span style="opacity:0.3">-</span>'}</td>
                            <td data-label="KATEGORI"><span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">${item.kategori}</span></td>
                            <td data-label="KETERANGAN" style="font-size:0.85rem;">${item.keterangan || '-'}</td>
                            <td data-label="NOMINAL" style="color: ${isIncome ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                                ${isIncome ? '+' : '-'} ${formatRp(item.nominal)}
                            </td>
                            <td data-label="TIPE" style="font-size:0.8rem; text-transform:capitalize;">${item.tipe}</td>
                            <td data-label="CHANNEL" style="font-size:0.8rem; color:var(--text-muted)">${item.channel || '-'}</td>
                            <td data-label="PHOTO" style="text-align:center;">
                                ${item.bukti_url ? `<button class="btn btn-sm" onclick="window.viewPhoto('${item.bukti_url}')" style="width:30px; height:30px; border-radius:4px; padding:0; overflow:hidden; border:1px solid rgba(255,255,255,0.1);"><img src="${window.getDirectDriveLink(item.bukti_url)}" style="width:100%; height:100%; object-fit:cover;"></button>` : '🚫'}
                            </td>
                            <td data-label="AKSI" style="white-space:nowrap;">
                                <button class="btn btn-sm btn-edit-action" onclick="window.handleEdit('${item.id}')" title="Edit" style="background:rgba(168,85,247,0.1); color:#a855f7; margin-right:4px;">✏️</button>
                                <button class="btn btn-sm btn-delete-action" onclick="window.handleDelete('${item.id}')" title="Hapus" style="background:rgba(239,68,68,0.1); color:var(--danger);">🗑️</button>
                            </td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }

                // Balance Calculations per Channel
                let balances = { 'Tunai / Cash': 0 };
                let inByChannel = { 'Tunai / Cash': 0 };
                let outByChannel = { 'Tunai / Cash': 0 };
                const rekenings = await getBankAccounts();
                rekenings.forEach(acc => { 
                    const k = `TF ${acc.bank} - ${acc.norek} (${acc.an})`;
                    balances[k] = 0; inByChannel[k] = 0; outByChannel[k] = 0; 
                });

                data.forEach(item => {
                    const chRaw = item.channel || 'Tunai / Cash';
                    let ch = chRaw;
                    if(['Cash', 'Tunai', 'Tunai / Cash', '-', 'Tunai/Lainnya'].includes(ch)) ch = 'Tunai / Cash';
                    if(!balances.hasOwnProperty(ch)) { balances[ch] = 0; inByChannel[ch] = 0; outByChannel[ch] = 0; }
                    const nom = parseFloat(item.nominal) || 0;
                    if (item.tipe === 'pemasukan') { balances[ch] += nom; inByChannel[ch] += nom; inTotal += nom; }
                    else if (item.tipe === 'pengeluaran') { balances[ch] -= nom; outByChannel[ch] += nom; outTotal += nom; }
                });

                if(totalPemasukanEl) totalPemasukanEl.textContent = formatRp(inTotal);
                if(totalPengeluaranEl) totalPengeluaranEl.textContent = formatRp(outTotal);

                const containerBalance = document.getElementById('containerRealtimeBalance');
                if(containerBalance) {
                    containerBalance.innerHTML = '';
                    const sortedEntries = Object.entries(balances)
                        .filter(([name]) => {
                            const low = name.toLowerCase();
                            return !low.includes('non kas') && !low.includes('non-kas');
                        })
                        .sort(([nameA], [nameB]) => {
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
                        let label = chan.replace('TF ', 'Bank ');
                        if (label.includes(' (')) label = label.split(' (')[0];
                        if (label.includes(' - ')) label = label.split(' - ')[0];
                        const inVal = inByChannel[chan] || 0;
                        const outVal = outByChannel[chan] || 0;
                        containerBalance.innerHTML += `
                        <div class="balance-card">
                            <div class="balance-info">
                                <div class="balance-label">${label.toUpperCase()}</div>
                                <div class="balance-value" style="color:${val < 0 ? 'var(--danger)' : 'var(--success)'}">${formatRp(val)}</div>
                                <div class="balance-subinfo">
                                    <span style="color:var(--success)"><span class="icon-emoji">⬇️</span> ${formatRp(inVal)}</span>
                                    <span style="color:var(--danger)"><span class="icon-emoji">⬆️</span> ${formatRp(outVal)}</span>
                                </div>
                            </div>
                        </div>`;
                    }
                }
            } catch(e) { window.showAlert("Render Error: " + e.message, "danger"); }
        };

        // Exposed handlers (Window Scope)
        window.handleEdit = async (id) => {
            const { data: item } = await supabase.from('keuangan').select('*').eq('id', id).single();
            if(!item) return;
            formKeuangan.reset();
            window.editingId = item.id;
            modalTitle.textContent = 'Edit Transaksi';
            tipeInput.value = item.tipe;
            tanggalInput.value = item.tanggal;
            nominalInput.value = item.nominal;
            keteranganInput.value = item.keterangan;
            await populateKategori(item.tipe);
            kategoriInput.value = item.kategori;
            
            // Reset & Populate Photo
            const pArea = document.getElementById('previewBuktiKeuangan');
            const pImg = pArea?.querySelector('img');
            if(item.bukti_url) { 
                window.existingKeuBuktiUrl = item.bukti_url;
                if(pImg) pImg.src = window.getDirectDriveLink(item.bukti_url); 
                if(pArea) pArea.style.display = 'flex'; 
            } else {
                window.existingKeuBuktiUrl = null;
                if(pArea) pArea.style.display = 'none';
            }
            
            modalKeuangan.classList.add('active');
        };

        window.handleDelete = async (id) => {
            window.showConfirm('Hapus transaksi ini?', async () => {
                await supabase.from('keuangan').delete().eq('id', id);
                renderApp();
                window.showToast('Data dihapus', 'success');
            });
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

        // LISTENERS
        document.getElementById('btnTambahPemasukan')?.addEventListener('click', () => { 
            formKeuangan.reset(); window.editingId = null; window.existingKeuBuktiUrl = null;
            document.getElementById('previewBuktiKeuangan').style.display = 'none';
            tipeInput.value = 'pemasukan'; modalTitle.textContent = 'Catat Pemasukan'; tanggalInput.value = window.getLocalDate(); 
            containerKategori.style.display = 'block'; containerMutasiTujuan.style.display = 'none'; 
            populateKategori('pemasukan'); modalKeuangan.classList.add('active'); 
        });

        document.getElementById('btnTambahPengeluaran')?.addEventListener('click', () => { 
            formKeuangan.reset(); window.editingId = null; window.existingKeuBuktiUrl = null;
            document.getElementById('previewBuktiKeuangan').style.display = 'none';
            tipeInput.value = 'pengeluaran'; modalTitle.textContent = 'Catat Pengeluaran'; tanggalInput.value = window.getLocalDate(); 
            containerKategori.style.display = 'block'; containerMutasiTujuan.style.display = 'none'; 
            populateKategori('pengeluaran'); modalKeuangan.classList.add('active'); 
        });

        document.getElementById('btnTambahMutasi')?.addEventListener('click', async () => {
            formKeuangan.reset(); window.editingId = null;
            tipeInput.value = 'mutasi'; modalTitle.textContent = '⇄ Mutasi Antar Rekening'; tanggalInput.value = window.getLocalDate(); 
            containerKategori.style.display = 'none'; containerMutasiTujuan.style.display = 'block'; 
            const reks = await getBankAccounts();
            transaksiMutasiTujuan.innerHTML = '<option value="">-- Pilih Tujuan --</option><option value="Tunai">💵 Tunai / Cash</option><option value="Kas Operasional">🏷️ Kas Operasional</option>';
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
            try {
                const nominal = window.parseNum(nominalInput.value);
                const tgl = tanggalInput.value;
                const kat = kategoriInput.value;
                const ket = (keteranganInput.value || '').trim();
                const tipe = tipeInput.value;
                const chan = transaksiChannel.value;

                if(tipe === 'mutasi') {
                    const dest = transaksiMutasiTujuan.value;
                    let destChannel = (dest === 'Tunai') ? 'Tunai / Cash' : (dest === 'Kas Operasional' ? 'Kas Operasional' : transaksiMutasiTujuan.options[transaksiMutasiTujuan.selectedIndex].textContent);
                    let srcChannel = chan === 'Transfer Bank' ? `TF ${transaksiRekId.options[transaksiRekId.selectedIndex].textContent}` : chan;
                    const mid = 'MUT-' + Date.now().toString().slice(-6);
                    await supabase.from('keuangan').insert([
                        { id: mid + '-O', tipe: 'pengeluaran', tanggal: tgl, kategori: 'Mutasi Antar Rekening', nominal, keterangan: 'Mutasi Ke ' + destChannel + ' | ' + ket, channel: srcChannel },
                        { id: mid + '-I', tipe: 'pemasukan', tanggal: tgl, kategori: 'Mutasi Antar Rekening', nominal, keterangan: 'Mutasi Dari ' + srcChannel + ' | ' + ket, channel: destChannel }
                    ]);
                } else {
                    let finalChannel = chan === 'Transfer Bank' ? `TF ${transaksiRekId.options[transaksiRekId.selectedIndex].textContent}` : chan;
                    
                    let finalBuktiUrl = window.existingKeuBuktiUrl || null;
                    if (inpBukti?.files.length > 0) {
                        const b64 = await compressImage(inpBukti.files[0]);
                        finalBuktiUrl = await uploadToGDrive(b64, 'BUKTI_KEUANGAN');
                    }

                    await supabase.from('keuangan').upsert([{ 
                        id: window.editingId || ('FIN-' + Date.now().toString().slice(-6)),
                        tipe, tanggal: tgl, kategori: kat, nominal, keterangan: ket, channel: finalChannel,
                        bukti_url: finalBuktiUrl
                    }]);
                }
                modalKeuangan.classList.remove('active');
                renderApp();
                window.showToast('Berhasil!', 'success');
            } catch (err) { window.showAlert(err.message, 'danger'); }
            finally { if (btnSaveModal) { btnSaveModal.disabled = false; btnSaveModal.innerHTML = originalText; } }
        });

        // Admin Action Handlers
        const handleSyncAll = async () => {
            window.showConfirm('Sinkronkan seluruh saldo?', async () => {
                window.showToast('Sinkronisasi berjalan...', 'info');
                const { data: trxs } = await supabase.from('transaksi').select('id');
                const { data: fins } = await supabase.from('keuangan').select('*');
                for (const trx of (trxs || [])) {
                    const rel = (fins || []).filter(f => f.related_trx_id === trx.id);
                    const total = rel.reduce((s, f) => s + (parseFloat(f.nominal) || 0), 0);
                    const history = rel.map(f => ({ payId: f.id, tgl: f.tanggal, nominal: parseFloat(f.nominal), channel: f.channel, buktiUrl: f.bukti_url }));
                    await supabase.from('transaksi').update({ total_paid: total, history_bayar: history }).eq('id', trx.id);
                }
                window.showAlert('Sinkron Selesai!', 'success', () => window.location.reload());
            });
        };

        const handleExport = async () => {
            const btn = document.getElementById('btnExportKeuangan');
            if(btn) { btn.disabled = true; btn.innerText = 'Memproses...'; }
            try {
                const { data } = await supabase.from('keuangan').select('*').order('tanggal', { ascending: false });
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Keuangan');
                XLSX.writeFile(wb, `Export_Keuangan_${new Date().toISOString().split('T')[0]}.xlsx`);
                window.showToast('Export Berhasil!', 'success');
            } catch(e) { window.showAlert(e.message, 'danger'); }
            finally { if(btn) { btn.disabled = false; btn.innerText = '📥 Export Excel'; } }
        };

        if(btnSaveModal) btnSaveModal.onclick = () => formKeuangan?.requestSubmit();
        document.getElementById('btnExportKeuangan')?.addEventListener('click', handleExport);

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
        
        // Final Init
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
        
        // --- PHOTO & CAMERA HANDLING ---
        const inpBukti = document.getElementById('inpBuktiKeuangan');
        const btnCamera = document.getElementById('btnOpenCameraKeu');
        const btnRemovePhoto = document.getElementById('btnRemoveKeuPhoto');
        const previewArea = document.getElementById('previewBuktiKeuangan');
        const previewImg = previewArea?.querySelector('img');
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
                        let width = img.width, height = img.height;
                        const max = 800;
                        if (width > height) { if (width > max) { height *= max / width; width = max; } } 
                        else { if (height > max) { width *= max / height; height = max; } }
                        canvas.width = width; canvas.height = height;
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
                    body: JSON.stringify({ base64: base64, mimeType: "image/jpeg", fileName: "finance_" + Date.now(), folderName: folderName })
                });
                const result = await response.json();
                return result.success ? window.getDirectDriveLink(result.url) : null;
            } catch (error) { console.error('GDrive Upload failed:', error); return null; }
        }

        if (inpBukti) {
            inpBukti.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        if(previewImg) previewImg.src = re.target.result;
                        if(previewArea) previewArea.style.display = 'flex';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (btnCamera && window.openCameraUI) {
            btnCamera.addEventListener('click', () => {
                window.openCameraUI((file) => {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    if (inpBukti) {
                        inpBukti.files = dt.files;
                        inpBukti.dispatchEvent(new Event('change'));
                    }
                });
            });
        }

        if (btnRemovePhoto) {
            btnRemovePhoto.addEventListener('click', () => {
                if(inpBukti) inpBukti.value = '';
                if(previewArea) previewArea.style.display = 'none';
                window.existingKeuBuktiUrl = null;
            });
        }

        // --- ADD MISSING FILTER LISTENERS ---
        document.getElementById('inpSearchKeuangan')?.addEventListener('input', debounce(() => renderApp(), 300));
        document.getElementById('filterTipe')?.addEventListener('change', () => renderApp());
        document.getElementById('filterChannel')?.addEventListener('change', () => renderApp());
        document.getElementById('filterKategori')?.addEventListener('change', () => renderApp());

        await renderApp();
        window.showToast('Sistem Keuangan Siap', 'success');

    } catch(globalErr) {
        window.showAlert("Setup Error: " + globalErr.message, "danger");
    }
});
