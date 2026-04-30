
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

    const loadData = async () => {
        try {
            // 1. Fetch Master Locations
            const masterLocations = await getMasterLocations();
            
            // 2. Fetch all goats that are currently in the pen (status_fisik = 'Ada')
            const { data: goats, error } = await supabase
                .from('stok_kambing')
                .select('id, no_tali, lokasi')
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
                    // Handle locations not in master data
                    pens[locName] = {
                        goats: [],
                        capacity: 10, // Default
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

    const renderGrid = (pens, masterLocations) => {
        penGrid.innerHTML = '';
        
        // Sort pen names alphabetically
        const sortedPenNames = Object.keys(pens).sort();

        sortedPenNames.forEach(name => {
            const pen = pens[name];
            const count = pen.goats.length;
            const capacity = pen.capacity;
            const percentage = capacity > 0 ? Math.round((count / capacity) * 100) : 0;
            const status = getStatusInfo(percentage);

            const card = document.createElement('div');
            card.className = `pen-card ${count === 0 ? 'empty-pen' : ''}`;
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
                </div>
                <div class="progress-container">
                    <div class="progress-bar ${status.barClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div style="font-size: 0.75rem; display: flex; justify-content: space-between; color: var(--text-muted);">
                    <span>Kepadatan: ${percentage}%</span>
                    <span>Max: ${capacity}</span>
                </div>
                <div class="capacity-control">
                    <span>Atur Kapasitas:</span>
                    <input type="number" class="capacity-input" data-pen="${name}" value="${capacity}" min="1">
                    <span style="font-size: 0.65rem; opacity: 0.7;">(Auto-save)</span>
                </div>
            `;

            penGrid.appendChild(card);
        });

        // Add event listeners for capacity inputs
        document.querySelectorAll('.capacity-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const penName = e.target.dataset.pen;
                const newVal = parseInt(e.target.value);
                if (newVal > 0) {
                    // Update in Master Data if it exists there
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
                            loadData(); // Re-render
                        }
                    } else {
                        // For non-master locations, just local update or show warning
                        window.showToast('Lokasi ini tidak terdaftar di Pengaturan. Update hanya sementara.', 'warning');
                        // Local storage fallback for ad-hoc locations
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

    btnRefresh.addEventListener('click', loadData);
    
    // Initial load
    loadData();
});

