
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const penGrid = document.getElementById('penGrid');
    const totalPensEl = document.getElementById('totalPens');
    const totalLivestockEl = document.getElementById('totalLivestock');
    const overloadCountEl = document.getElementById('overloadCount');
    const avgDensityEl = document.getElementById('avgDensity');
    const btnRefresh = document.getElementById('btnRefresh');

    // Fetch master locations from Settings
    const getMasterLocations = async () => {
        const { data, error } = await supabase.from('master_data').select('val').eq('key', 'LOKASI').single();
        if (error && error.code !== 'PGRST116') console.error('Error fetching locations:', error);
        return data?.val || [];
    };

    const getUnitStyle = (colorName) => {
        const colors = {
            'biru': '#3b82f6',
            'merah': '#ef4444',
            'kuning': '#fbbf24', // Amber-400 for better visibility
            'hijau': '#10b981',
            'ungu': '#8b5cf6',
            'pink': '#ec4899',
            'hitam': '#111827',
            'putih': '#ffffff',
            'orange': '#f97316',
            'coklat': '#78350f'
        };
        const key = (colorName || '').toLowerCase().trim();
        const bg = colors[key] || 'var(--primary)';
        // Change text color to black for light backgrounds
        const isLight = ['putih', 'kuning'].includes(key);
        const text = isLight ? '#000' : '#fff';
        const shadow = isLight ? 'none' : '0 1px 2px rgba(0,0,0,0.6)';
        const border = isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)';
        
        return `background-color: ${bg}; color: ${text}; text-shadow: ${shadow}; border: ${border};`;
    };

    const loadData = async () => {
        try {
            // 1. Fetch Master Locations
            const masterLocations = await getMasterLocations();
            
            // 2. Fetch all goats that are currently in the pen (status_fisik = 'Ada')
            const { data: goats, error } = await supabase
                .from('stok_kambing')
                .select('*') // Fetch all fields for detail view
                .eq('status_fisik', 'Ada');

            if (error) throw error;

            // 3. Prepare Pens Object
            const pens = {};
            
            // Initialize with master locations
            masterLocations.forEach(loc => {
                pens[loc.nama] = {
                    goats: [],
                    capacity: parseInt(loc.kapasitas) || 10,
                    id: loc.id
                };
            });

            // Group goats by location
            goats.forEach(g => {
                const locName = g.lokasi || 'UNSET';
                if (!pens[locName]) {
                    pens[locName] = {
                        goats: [],
                        capacity: 10, 
                        id: 'UNTRACKED-' + locName
                    };
                }
                pens[locName].goats.push(g);
            });

            renderGrid(pens, masterLocations);
            updateSummary(pens);
        } catch (err) {
            console.error('Error loading pen data:', err);
            if (window.showAlert) window.showAlert('Gagal memuat data kandang: ' + err.message, 'danger');
            else alert('Gagal memuat data kandang: ' + err.message);
        }
    };

    const getStatusInfo = (percentage) => {
        if (percentage > 100) return { label: 'Overload', class: 'status-overload', barClass: 'bar-overload' };
        if (percentage >= 85) return { label: 'Penuh', class: 'status-warning', barClass: 'bar-warning' };
        if (percentage >= 40) return { label: 'Optimal', class: 'status-optimal', barClass: 'bar-optimal' };
        return { label: 'Longgar', class: 'status-low', barClass: 'bar-low' };
    };

    const openGoatDetail = async (goatId) => {
        const modal = document.getElementById('modalGoatDetail');
        if (!modal) return;

        // Show loading state or clear previous
        document.getElementById('goatPhoto').style.display = 'none';
        document.getElementById('goatNoPhoto').style.display = 'block';
        document.getElementById('goatTagBadge').textContent = '...';
        
        modal.classList.add('active');

        try {
            const { data: goat, error } = await supabase.from('stok_kambing').select('*').eq('id', goatId).single();
            if (error) throw error;

            // Populate Modal
            document.getElementById('goatTagBadge').textContent = '#' + (goat.no_tali || '-');
            document.getElementById('goatType').textContent = (goat.jenis || '-') + ' / ' + (goat.kategori || '-');
            document.getElementById('goatWeight').textContent = (goat.berat_estimasi || '-') + ' kg / ' + (goat.jenis_kelamin || '-');
            document.getElementById('goatLocation').textContent = goat.lokasi || '-';
            document.getElementById('goatNote').textContent = goat.keterangan || 'Tidak ada catatan khusus.';
            
            // Status Badge
            const statusBadge = document.getElementById('goatStatusBadge');
            statusBadge.textContent = `STATUS: ${goat.status_fisik || 'ADA'}`;
            if (goat.status_order === 'Terjual') {
                statusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
                statusBadge.style.color = '#10b981';
                statusBadge.textContent += ' (TERJUAL)';
            } else {
                statusBadge.style.background = 'rgba(59, 130, 246, 0.1)';
                statusBadge.style.color = '#3b82f6';
            }

            // Customer Info (if sold)
            if (goat.customer_name) {
                document.getElementById('goatCustomer').textContent = goat.customer_name;
            } else {
                document.getElementById('goatCustomer').textContent = 'STOK TERSEDIA';
            }

            // Photo
            const img = document.getElementById('goatPhoto');
            const noPhoto = document.getElementById('goatNoPhoto');
            if (goat.foto_url) {
                img.src = goat.foto_url;
                img.style.display = 'block';
                noPhoto.style.display = 'none';
            } else {
                img.style.display = 'none';
                noPhoto.style.display = 'block';
            }

        } catch (err) {
            console.error('Error fetching goat detail:', err);
            window.showToast('Gagal memuat detail kambing', 'danger');
            modal.classList.remove('active');
        }
    };

    const renderGrid = (pens, masterLocations) => {
        penGrid.innerHTML = '';
        const sortedPenNames = Object.keys(pens).sort();

        sortedPenNames.forEach(name => {
            const pen = pens[name];
            const count = pen.goats.length;
            const capacity = pen.capacity;
            const percentage = capacity > 0 ? Math.round((count / capacity) * 100) : 0;
            const status = getStatusInfo(percentage);

            let unitsHtml = '';
            pen.goats.forEach(g => {
                const style = getUnitStyle(g.warna_tali);
                unitsHtml += `
                    <div class="goat-unit" data-id="${g.id}" data-tag="${g.no_tali}" title="No Tali: ${g.no_tali} (${g.warna_tali || '-'})" style="${style}">
                        ${g.no_tali}
                        <div class="unit-tooltip">Klik untuk Detail (#${g.no_tali})</div>
                    </div>`;
            });
            const emptyCount = Math.max(0, capacity - count);
            for(let i = 0; i < emptyCount; i++) {
                unitsHtml += `<div class="goat-unit empty"></div>`;
            }

            const card = document.createElement('div');
            card.className = `pen-card ${count === 0 ? 'empty-pen' : ''}`;
            card.id = `pen-${name.replace(/\s+/g, '-')}`;
            card.innerHTML = `
                <div class="pen-header">
                    <div class="pen-name">${name}</div>
                    <span class="pen-badge ${status.class}">${status.label}</span>
                </div>
                <div class="pen-stats">
                    <div>
                        <span class="stat-value">${count}</span>
                        <span class="stat-label">ekor</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
                        ${percentage}% Kapasitas
                    </div>
                </div>

                <div class="visual-map">
                    ${unitsHtml}
                </div>

                <div style="font-size: 0.75rem; display: flex; justify-content: space-between; color: var(--text-muted); margin-top: auto;">
                    <span>Sisa Slot: ${Math.max(0, capacity - count)}</span>
                    <span>Kapasitas Max: ${capacity}</span>
                </div>
                <div class="capacity-control">
                    <span>Atur Kapasitas:</span>
                    <input type="number" class="capacity-input" data-pen="${name}" value="${capacity}" min="1">
                    <span style="font-size: 0.65rem; opacity: 0.7;">(Auto-save)</span>
                </div>
            `;

            penGrid.appendChild(card);
        });

        // Add event listeners for goat units
        document.querySelectorAll('.goat-unit:not(.empty)').forEach(unit => {
            unit.onclick = (e) => {
                e.stopPropagation();
                openGoatDetail(unit.dataset.id);
            };
        });

        // Add event listeners for capacity inputs
        document.querySelectorAll('.capacity-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const penName = e.target.dataset.pen;
                const newVal = parseInt(e.target.value);
                if (newVal > 0) {
                    const currentMaster = await getMasterLocations();
                    const idx = currentMaster.findIndex(l => l.nama === penName);
                    
                    if (idx !== -1) {
                        currentMaster[idx].kapasitas = newVal;
                        const { error } = await supabase.from('master_data').upsert({ 
                            id: 'ID-LOKASI', 
                            key: 'LOKASI', 
                            val: currentMaster 
                        }, { onConflict: 'key' });
                        
                        if (error) {
                            window.showToast('Gagal update ke Cloud: ' + error.message, 'danger');
                        } else {
                            window.showToast('Kapasitas diperbarui!', 'success');
                            loadData(); 
                        }
                    } else {
                        window.showToast('Lokasi ini tidak terdaftar di Pengaturan.', 'warning');
                        let localCaps = JSON.parse(localStorage.getItem('PEN_CAPACITIES')) || {};
                        localCaps[penName] = newVal;
                        localStorage.setItem('PEN_CAPACITIES', JSON.stringify(localCaps));
                        loadData();
                    }
                }
            });
        });
    };

    const updateSummary = (pens) => {
        const penNames = Object.keys(pens);
        const totalPens = penNames.length;
        let totalGoats = 0;
        let overloaded = 0;
        let totalDensity = 0;

        penNames.forEach(name => {
            const pen = pens[name];
            const count = pen.goats.length;
            const capacity = pen.capacity;
            const density = capacity > 0 ? (count / capacity) * 100 : 0;
            
            totalGoats += count;
            if (density > 100) overloaded++;
            totalDensity += density;
        });

        totalPensEl.textContent = totalPens;
        totalLivestockEl.textContent = totalGoats;
        overloadCountEl.textContent = overloaded;
        avgDensityEl.textContent = totalPens > 0 ? Math.round(totalDensity / totalPens) + '%' : '0%';
    };

    // SEARCH LOGIC
    const inpSearchGoat = document.getElementById('inpSearchGoat');
    inpSearchGoat.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        const units = document.querySelectorAll('.goat-unit:not(.empty)');
        
        units.forEach(u => {
            const tag = u.dataset.tag.toLowerCase();
            if (val && tag.includes(val)) {
                u.style.transform = 'scale(1.5)';
                u.style.zIndex = '10';
                u.style.boxShadow = '0 0 15px var(--primary)';
                u.style.borderColor = '#fff';
                
                // If it's an exact match, scroll into view
                if (tag === val) {
                    u.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                u.style.transform = '';
                u.style.zIndex = '';
                u.style.boxShadow = '';
                u.style.borderColor = '';
            }
        });
    });

    // Modal Close Logic
    const closeModal = () => document.getElementById('modalGoatDetail').classList.remove('active');
    document.getElementById('btnCloseModalDetail').onclick = closeModal;
    document.getElementById('btnCloseDetail').onclick = closeModal;
    window.onclick = (e) => {
        const modal = document.getElementById('modalGoatDetail');
        if (e.target === modal) closeModal();
    };

    btnRefresh.addEventListener('click', loadData);
    loadData();
});

