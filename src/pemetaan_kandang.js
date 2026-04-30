
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://juscihvfmgibmrhmclab.supabase.co';
const supabaseKey = 'sb_publishable_K6phM9DpcT4aqm1nvXdkYA_h9N1fQTQ';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
    const penGrid = document.getElementById('penGrid');
    const totalPensEl = document.getElementById('totalPens');
    const totalLivestockEl = document.getElementById('totalLivestock');
    const overloadCountEl = document.getElementById('overloadCount');
    const avgDensityEl = document.getElementById('avgDensity');
    const btnRefresh = document.getElementById('btnRefresh');

    // Default capacities stored in localStorage to persist user adjustments
    let penCapacities = JSON.parse(localStorage.getItem('PEN_CAPACITIES')) || {};

    const loadData = async () => {
        try {
            // Fetch all goats that are currently in the pen (status_fisik = 'Ada')
            const { data: goats, error } = await supabase
                .from('stok_kambing')
                .select('id, no_tali, lokasi')
                .eq('status_fisik', 'Ada');

            if (error) throw error;

            // Group goats by location
            const pens = {};
            goats.forEach(g => {
                const loc = g.lokasi || 'UNSET';
                if (!pens[loc]) pens[loc] = [];
                pens[loc].push(g);
            });

            renderGrid(pens);
            updateSummary(pens);
        } catch (err) {
            console.error('Error loading pen data:', err);
            alert('Gagal memuat data kandang: ' + err.message);
        }
    };

    const getStatusInfo = (percentage) => {
        if (percentage > 100) return { label: 'Overload', class: 'status-overload', barClass: 'bar-overload' };
        if (percentage >= 85) return { label: 'Penuh', class: 'status-warning', barClass: 'bar-warning' };
        if (percentage >= 40) return { label: 'Optimal', class: 'status-optimal', barClass: 'bar-optimal' };
        return { label: 'Longgar', class: 'status-low', barClass: 'bar-low' };
    };

    const renderGrid = (pens) => {
        penGrid.innerHTML = '';
        
        // Sort pen names alphabetically
        const sortedPenNames = Object.keys(pens).sort();

        sortedPenNames.forEach(name => {
            const count = pens[name].length;
            const capacity = penCapacities[name] || 10; // Default capacity 10
            const percentage = Math.round((count / capacity) * 100);
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
            input.addEventListener('change', (e) => {
                const penName = e.target.dataset.pen;
                const newVal = parseInt(e.target.value);
                if (newVal > 0) {
                    penCapacities[penName] = newVal;
                    localStorage.setItem('PEN_CAPACITIES', JSON.stringify(penCapacities));
                    loadData(); // Re-render
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
            const count = pens[name].length;
            const capacity = penCapacities[name] || 10;
            const density = (count / capacity) * 100;
            
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
