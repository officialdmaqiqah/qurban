import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Session & Profile
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // layout.js handles redirect

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) return;

    const user = profile;
    const isAdmin = user && user.role === 'admin';
    const email = profile.email;
    if (email) {
        const display = document.getElementById('userEmailDisplay');
        if (display) display.textContent = email;
    }


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
                    if (width > height) {
                        if (width > max) { height *= max / width; width = max; }
                    } else {
                        if (height > max) { width *= max / height; height = max; }
                    }
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
                    fileName: "masuk_" + Date.now(),
                    folderName: folderName || "FOTO_NOTA_SUPPLIER"
                })
            });
            const result = await response.json();
            return result.success ? window.getDirectDriveLink(result.url) : null;
        } catch (error) {
            console.error('GDrive Upload failed:', error);
            return null;
        }
    }
    
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = 'index.html';
    });

    if (!isAdmin) {
        ['btnInputManual', 'btnTriggerUpload', 'btnDownloadTemplate', 'btnHapusSemuaDraft', 'btnApproveDraft'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.style.display = 'none';
        });
    }

    
    const makeCustomId = (batchFull, supp, warna, noTali, sex) => {
        let b = (batchFull || '').replace(/\D/g, ''); 
        if(b.length >= 2) b = b.substring(b.length - 2);
        else b = b.padStart(2, '0');
        let s = (supp || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
        if(s.length < 2) s = s.padEnd(2, 'X'); else s = s.substring(0,2);
        let w = (warna || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
        if(w.length < 2) w = w.padEnd(2, 'X'); else w = w.substring(0,2);
        let n = (noTali || '').trim();
        let numParsed = parseInt(n);
        if(!isNaN(numParsed) && numParsed < 100) n = numParsed.toString().padStart(2, '0');
        else if (n.length < 2) n = n.padStart(2, '0');
        else if (n.length > 2) n = n.substring(n.length - 2); 
        let sx = (sex || 'J').toUpperCase().charAt(0);
        return `KB${b}${s}${w}${n}${sx}`;
    };

    if (!localStorage.getItem('QURBAN_KAMBING_DRAFT')) localStorage.setItem('QURBAN_KAMBING_DRAFT', '[]');
    let draftData = JSON.parse(localStorage.getItem('QURBAN_KAMBING_DRAFT'));

    const { data: suppliers } = await supabase.from('master_data').select('val').eq('key', 'SUPPLIERS').single();
    const inpSupplier = document.getElementById('inpSupplier');
    if (suppliers?.val && inpSupplier) {
        suppliers.val.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.nama; opt.textContent = s.nama;
            inpSupplier.appendChild(opt);
        });
    }

    const { data: lokasis } = await supabase.from('master_data').select('val').eq('key', 'LOKASI').single();
    const inpLokasi = document.getElementById('inpLokasi');
    if(lokasis?.val && inpLokasi) {
        lokasis.val.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.nama; opt.textContent = l.nama;
            inpLokasi.appendChild(opt);
        });
    }

    const generateBatchId = async () => {
        const { data, error } = await supabase
            .from('stok_kambing')
            .select('batch')
            .order('batch', { ascending: false })
            .limit(1);
        
        let maxNum = 0;
        if (data && data.length > 0) {
            maxNum = parseInt(data[0].batch.replace(/\D/g, '')) || 0;
        }

        // Also check draft for local consistency before saving
        draftData.forEach(item => {
            let num = parseInt(item.batch.replace(/\D/g, '')) || 0;
            if (num > maxNum) maxNum = num;
        });

        return `BT${(maxNum + 1).toString().padStart(3, '0')}`;
    };

    const calcKandang = () => {
        const nota = window.parseNum(document.getElementById('inpHargaNota').value);
        const saving = window.parseNum(document.getElementById('inpSaving').value);
        const profit = window.parseNum(document.getElementById('inpProfit').value);
        document.getElementById('inpHargaKandang').value = window.formatRp(nota + saving + profit);
    };
    document.getElementById('inpHargaNota').addEventListener('input', calcKandang);
    document.getElementById('inpSaving').addEventListener('input', calcKandang);
    document.getElementById('inpProfit').addEventListener('input', calcKandang);

    const modalInput = document.getElementById('modalInput');
    const inpFotoNota = document.getElementById('inpFotoNota');
    const previewFotoNota = document.getElementById('previewFotoNota');
    const btnOpenCameraMasuk = document.getElementById('btnOpenCameraMasuk');
    const btnRemoveMasukPhoto = document.getElementById('btnRemoveMasukPhoto');

    if(btnRemoveMasukPhoto) {
        btnRemoveMasukPhoto.onclick = () => {
            if(inpFotoNota) inpFotoNota.value = '';
            if(previewFotoNota) previewFotoNota.style.display = 'none';
        };
    }
    
    if(btnOpenCameraMasuk) {
        btnOpenCameraMasuk.onclick = () => {
            window.openCameraUI((file) => {
                const dt = new DataTransfer();
                dt.items.add(file);
                if(inpFotoNota) {
                    inpFotoNota.files = dt.files;
                    inpFotoNota.dispatchEvent(new Event('change'));
                }
            });
        };
    }

    if (inpFotoNota) {
        inpFotoNota.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    previewFotoNota.querySelector('img').src = re.target.result;
                    previewFotoNota.style.display = 'flex';
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }

    document.getElementById('btnInputManual').addEventListener('click', async () => {
        resetForm();
        document.getElementById('inpBatch').value = await generateBatchId();
        document.getElementById('inpTgl').valueAsDate = new Date();
        modalInput.classList.add('active');
    });

    const closeModal = () => modalInput.classList.remove('active');
    const resetForm = () => {
        document.getElementById('formInput').reset();
        document.getElementById('draftId').value = '';
        document.getElementById('inpHargaKandang').value = '';
        if (inpFotoNota) inpFotoNota.value = '';
        if (previewFotoNota) {
            previewFotoNota.style.display = 'none';
            previewFotoNota.querySelector('img').src = '';
        }
    };
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    document.getElementById('btnCancelModal').addEventListener('click', closeModal);

    document.getElementById('formInput').addEventListener('submit', async (e) => {
        e.preventDefault();
        const hNota = window.parseNum(document.getElementById('inpHargaNota').value);
        const hSaving = window.parseNum(document.getElementById('inpSaving').value);
        const hProfit = window.parseNum(document.getElementById('inpProfit').value);
        
        let fotoNotaUrl = null;
        if (inpFotoNota && inpFotoNota.files.length > 0) {
            window.showToast('Mengunggah foto nota...', 'info');
            const b64 = await compressImage(inpFotoNota.files[0]);
            fotoNotaUrl = await uploadToGDrive(b64, 'FOTO_NOTA_SUPPLIER');
        }

        const editingId = document.getElementById('draftId').value;
        const newItem = {
            id: editingId || makeCustomId(document.getElementById('inpBatch').value, document.getElementById('inpSupplier').value, document.getElementById('inpWarnaTali').value, document.getElementById('inpNoTali').value, document.getElementById('inpSex').value),
            batch: document.getElementById('inpBatch').value,
            tglMasuk: document.getElementById('inpTgl').value,
            supplier: document.getElementById('inpSupplier').value,
            noTali: document.getElementById('inpNoTali').value,
            warnaTali: document.getElementById('inpWarnaTali').value,
            sex: document.getElementById('inpSex').value,
            lokasi: document.getElementById('inpLokasi') ? document.getElementById('inpLokasi').value : '',
            berat: document.getElementById('inpBerat') ? document.getElementById('inpBerat').value : '',
            hargaNota: hNota,
            saving: hSaving,
            profit: hProfit,
            hargaKandang: hNota + hSaving + hProfit,
            fotoNotaUrl: fotoNotaUrl || (editingId ? draftData.find(d => d.id === editingId)?.fotoNotaUrl : null),
            statusTransaksi: 'Tersedia', statusKesehatan: 'Sehat', statusFisik: 'Ada'
        };

        if (editingId) {
            const idx = draftData.findIndex(x => x.id === editingId);
            draftData[idx] = newItem;
        } else {
            draftData.push(newItem);
        }
        saveDraft();
        closeModal();
    });

    const saveDraft = () => {
        localStorage.setItem('QURBAN_KAMBING_DRAFT', JSON.stringify(draftData));
        renderTable();
    };

    const tableBody = document.getElementById('tableBodyDraft');
    const draftCountSpan = document.getElementById('draftCount');
    const emptyState = document.getElementById('emptyState');
    
    const renderTable = () => {
        tableBody.innerHTML = '';
        draftCountSpan.textContent = draftData.length;
        if (draftData.length === 0) {
            emptyState.style.display = 'block';
            document.querySelector('.table-responsive').style.display = 'none';
            document.getElementById('btnApproveDraft').style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            document.querySelector('.table-responsive').style.display = 'block';
            document.getElementById('btnApproveDraft').style.display = 'inline-block';
            draftData.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight:600;">${item.batch}</td>
                    <td>${item.tglMasuk}</td>
                    <td>${item.supplier || '-'}</td>
                    <td class="sticky-col">
                        <div style="font-weight:600;">${item.noTali}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted); font-weight:400; margin-top:2px;">${item.warnaTali || '-'}</div>
                        ${item.fotoNotaUrl ? `<button class="btn btn-sm btn-view-photo" data-url="${window.getDirectDriveLink(item.fotoNotaUrl)}" title="Lihat Foto Nota">📸</button>` : ''}
                    </td>
                    <td>${item.sex || '-'}</td>
                    <td style="font-weight:600; color:var(--primary);">${item.berat ? item.berat + ' kg' : '-'}</td>
                    <td><span class="badge" style="background:rgba(255,255,255,0.1);">${item.lokasi || '-'}</span></td>
                    <td style="font-weight:bold; color:var(--success);">${formatRp(item.hargaKandang)}</td>
                    <td style="text-align:right;">
                        <div class="action-btns">
                            <button class="btn btn-sm btn-edit" onclick="editDraft('${item.id}')" title="Edit">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteDraft('${item.id}')" title="Hapus">🗑️</button>
                        </div>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        if (window.enforceGlobalReadonly) window.enforceGlobalReadonly();

        // Event for viewing photo (Lightbox)
        document.querySelectorAll('.btn-view-photo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = e.currentTarget.getAttribute('data-url');
                const modal = document.getElementById('photoLightbox');
                const img = document.getElementById('lightboxImg');
                const loader = document.getElementById('lightboxLoading');
                const btnDownload = document.getElementById('btnDownloadLightbox');
                
                if(modal && img) {
                    img.style.display = 'none';
                    if(loader) {
                        loader.style.display = 'block';
                        loader.textContent = 'Memuat Foto...';
                        loader.style.color = 'white';
                    }
                    img.src = url;
                    modal.style.display = 'flex';

                    // Setup Download Button
                    if (btnDownload) {
                        btnDownload.onclick = async (ev) => {
                            ev.stopPropagation();
                            try {
                                const originalText = btnDownload.innerHTML;
                                btnDownload.innerHTML = '⏳ Menyiapkan File...';
                                btnDownload.style.opacity = '0.7';
                                btnDownload.style.pointerEvents = 'none';

                                // Create a proxy image to handle CORS
                                const tempImg = new Image();
                                tempImg.crossOrigin = "anonymous";
                                tempImg.src = url;

                                await new Promise((resolve, reject) => {
                                    tempImg.onload = resolve;
                                    tempImg.onerror = () => reject(new Error("Gagal memuat gambar untuk diunduh."));
                                });

                                // Draw to canvas
                                const canvas = document.createElement('canvas');
                                const ctx = canvas.getContext('2d');
                                canvas.width = tempImg.naturalWidth;
                                canvas.height = tempImg.naturalHeight;
                                ctx.drawImage(tempImg, 0, 0);

                                // --- DRAW OVERLAY ---
                                const fontSize = Math.round(canvas.width * 0.035);
                                const barHeight = fontSize * 2.2;
                                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                                ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

                                ctx.fillStyle = 'white';
                                ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                                ctx.textBaseline = 'middle';
                                const padding = fontSize * 0.8;
                                const noTali = item.noTali || '-';
                                const warnaTali = item.warnaTali || '-';
                                ctx.fillText(`NO TALI: ${noTali}   |   WARNA: ${warnaTali}`, padding, canvas.height - (barHeight / 2));

                                // Convert to dataURL
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

                                // Trigger Download
                                const a = document.createElement('a');
                                a.href = dataUrl;
                                a.download = `kambing_${noTali}.jpg`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);

                                if(window.showToast) window.showToast('Foto Berhasil Diunduh!');
                                
                                btnDownload.innerHTML = originalText;
                            } catch (error) {
                                console.error('Download failed:', error);
                                if(window.showAlert) window.showAlert('Gagal mengunduh foto. Mengalihkan ke link langsung...', 'warning');
                                window.open(url, '_blank');
                            } finally {
                                btnDownload.style.opacity = '1';
                                btnDownload.style.pointerEvents = 'auto';
                            }
                        };
                    }

                    img.onload = () => {
                        loader.style.display = 'none';
                        img.style.display = 'block';
                    };

                    img.onerror = () => {
                        if(loader) {
                            loader.innerHTML = `Gagal memuat foto.<br><span style="font-size:0.7rem; color:white; font-style:normal;">Pastikan file di Google Drive sudah diset ke <b>"Anyone with the link can view"</b>.</span>`;
                            loader.style.color = '#ef4444';
                        }
                    };
                }
            });
        });
    };

    window.editDraft = (id) => {
        const item = draftData.find(x => x.id === id);
        if(!item) return;
        document.getElementById('draftId').value = item.id;
        document.getElementById('inpBatch').value = item.batch;
        document.getElementById('inpTgl').value = item.tglMasuk;
        document.getElementById('inpSupplier').value = item.supplier;
        document.getElementById('inpNoTali').value = item.noTali;
        document.getElementById('inpWarnaTali').value = item.warnaTali;
        document.getElementById('inpSex').value = item.sex;
        if(document.getElementById('inpLokasi')) document.getElementById('inpLokasi').value = item.lokasi || '';
        if(document.getElementById('inpBerat')) document.getElementById('inpBerat').value = item.berat || '';
        document.getElementById('inpHargaNota').value = item.hargaNota;
        document.getElementById('inpSaving').value = item.saving;
        document.getElementById('inpProfit').value = item.profit;
        if (item.fotoNotaUrl && previewFotoNota) {
            previewFotoNota.querySelector('img').src = item.fotoNotaUrl;
            previewFotoNota.style.display = 'block';
        }
        calcKandang();
        modalInput.classList.add('active');
    };

    window.deleteDraft = (id) => {
        window.showConfirm('Hapus item ini dari draft? Tindakan ini tidak dapat dibatalkan.', () => {
            draftData = draftData.filter(x => x.id !== id);
            saveDraft();
        }, null, 'Konfirmasi Hapus', 'Ya, Konfirmasi', 'btn-danger');
    };

    document.getElementById('btnHapusSemuaDraft').addEventListener('click', () => {
        window.showConfirm('Yakin ingin mengosongkan semua draft masuk? Seluruh data yang belum disimpan akan hilang.', () => {
            draftData = [];
            saveDraft();
        }, null, 'Konfirmasi Hapus', 'Ya, Konfirmasi', 'btn-danger');
    });

    document.getElementById('btnApproveDraft').addEventListener('click', () => {
        window.showConfirm('Setujui semua draft masuk ke Data Stok? Data akan dikunci dan masuk ke inventaris utama.', async () => {
            window.showToast('Menyimpan data ke Cloud...', 'info');
            
            // Map keys to match DB schema
            const cloudData = draftData.map(d => ({
                id: d.id,
                batch: d.batch,
                tgl_masuk: d.tglMasuk,
                supplier: d.supplier,
                no_tali: d.noTali,
                warna_tali: d.warnaTali,
                sex: d.sex,
                lokasi: d.lokasi,
                berat: d.berat ? parseFloat(d.berat) : null,
                harga_nota: d.hargaNota,
                saving: d.saving,
                profit: d.profit,
                harga_kandang: d.hargaKandang,
                status_transaksi: 'Tersedia',
                status_kesehatan: 'Sehat',
                status_fisik: 'Ada',
                foto_nota_url: d.fotoNotaUrl
            }));

            const { error } = await supabase
                .from('stok_kambing')
                .insert(cloudData);

            if (error) {
                window.showAlert('Gagal menyimpan ke Cloud: ' + error.message, 'danger');
                return;
            }

            draftData = [];
            saveDraft();
            window.showAlert('Data Berhasil Disetujui dan Tersimpan di Cloud!', 'success', () => { 
                window.location.href = 'kambing.html'; 
            });
        }, null, 'Konfirmasi Persetujuan', 'Ya, Konfirmasi', 'btn-danger');
    });

    // CSV Logic
    document.getElementById('btnDownloadTemplate').addEventListener('click', () => {
        const csv = "Tgl Masuk (dd/mm/yy),Supplier,No Tali,Warna Tali,Sex,Harga Nota,Nilai Saving,Profit,Lokasi,Berat\n10/05/24,Supp A,01,Merah,Jantan,2500000,50000,100000,Kandang A,35.5";
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Template_Kambing_Masuk.csv';
        link.click();
    });

    const fileInput = document.getElementById('fileCsv');
    document.getElementById('btnTriggerUpload').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const parseDateString = (str) => {
            if (!str) return new Date().toISOString().split('T')[0];
            const p = str.split('/');
            if (p.length === 3) {
                let y = p[2].trim();
                let m = p[1].trim().padStart(2, '0');
                let d = p[0].trim().padStart(2, '0');
                if (y.length === 2) y = '20' + y;
                return `${y}-${m}-${d}`;
            }
            return str; // Fallback
        };

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const lines = ev.target.result.split('\n');
            const batch = await generateBatchId();
            for(let i=1; i<lines.length; i++){
                const cols = lines[i].split(',');
                if(cols.length < 5) continue;
                draftData.push({
                    id: makeCustomId(batch, cols[1], cols[3], cols[2], cols[4]),
                    batch, tglMasuk: parseDateString(cols[0]), supplier: cols[1], noTali: cols[2], warnaTali: cols[3], sex: cols[4],
                    berat: cols[9] || '',
                    hargaNota: window.parseNum(cols[5]), saving: window.parseNum(cols[6]), profit: window.parseNum(cols[7]),
                    lokasi: cols[8]||'', hargaKandang: window.parseNum(cols[5]) + window.parseNum(cols[6]) + window.parseNum(cols[7]),
                    statusTransaksi: 'Tersedia', statusKesehatan: 'Sehat', statusFisik: 'Ada'
                });
            }
            saveDraft();
            fileInput.value = '';
        };
        reader.readAsText(file);
    });

    renderTable();
});
