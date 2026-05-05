
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
                .select('*')
                .eq('status_fisik', 'Ada');

            if (error) throw error;

            // 3. Fetch Related Transactions for search context
            const trxIds = [...new Set(goats.map(g => g.transaction_id).filter(id => id))];
            let transactionsMap = {};
            if (trxIds.length > 0) {
                const { data: trxs } = await supabase.from('transaksi').select('id, customer, items').in('id', trxIds);
                (trxs || []).forEach(t => {
                    transactionsMap[t.id] = t;
                });
            }

            // 4. Prepare Pens Object
            const pens = {};
            masterLocations.forEach(loc => {
                pens[loc.nama] = {
                    goats: [],
                    capacity: parseInt(loc.kapasitas) || 10,
                    id: loc.id
                };
            });

            // Group goats and attach extra context for search
            goats.forEach(g => {
                const locName = g.lokasi || 'UNSET';
                if (!pens[locName]) {
                    pens[locName] = { goats: [], capacity: 10, id: 'UNTRACKED-' + locName };
                }
                
                // Attach search context
                const trx = transactionsMap[g.transaction_id];
                g._searchContext = {
                    customer: (trx?.customer?.nama || '').toLowerCase(),
                    sohibul: (trx?.items?.find(it => it.goatId === g.id)?.namaSohibul || '').toLowerCase()
                };

                pens[locName].goats.push(g);
            });

            renderGrid(pens, masterLocations);
            updateSummary(pens);
        } catch (err) {
            console.error('Error loading pen data:', err);
            if (window.showAlert) window.showAlert('Gagal memuat data kandang: ' + err.message, 'danger');
            else showAlert('Gagal memuat data kandang: ' + err.message, 'danger');
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
        document.getElementById('goatSohibul').textContent = 'Memuat...';
        
        modal.classList.add('active');

        try {
            const { data: goat, error } = await supabase.from('stok_kambing').select('*').eq('id', goatId).single();
            if (error) throw error;

            // Populate Modal
            document.getElementById('goatTagBadge').textContent = '#' + (goat.no_tali || '-');
            document.getElementById('goatLocation').textContent = goat.lokasi || '-';
            document.getElementById('goatNote').textContent = goat.keterangan || 'Tidak ada catatan khusus.';
            
            // Status Badge
            const statusBadge = document.getElementById('goatStatusBadge');
            statusBadge.textContent = `STATUS FISIK: ${goat.status_fisik || 'ADA'}`;
            
            if (goat.status_transaksi === 'Terjual' || goat.status_transaksi === 'Terdistribusi') {
                statusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
                statusBadge.style.color = '#10b981';
                statusBadge.textContent += ` (${goat.status_transaksi.toUpperCase()})`;
            } else {
                statusBadge.style.background = 'rgba(59, 130, 246, 0.1)';
                statusBadge.style.color = '#3b82f6';
            }

            // Customer Info & Sohibul & Price
            const priceContainer = document.getElementById('goatPriceContainer');
            if (goat.status_transaksi === 'Terjual' || goat.status_transaksi === 'Terdistribusi') {
                // HIDE Price if SOLD
                if (priceContainer) priceContainer.style.display = 'none';
                
                if (goat.transaction_id) {
                    const { data: trx } = await supabase.from('transaksi').select('*').eq('id', goat.transaction_id).single();
                    if (trx) {
                        document.getElementById('goatCustomer').textContent = trx.customer?.nama || '-';
                        const itemInTrx = (trx.items || []).find(it => it.goatId === goat.id);
                        document.getElementById('goatSohibul').textContent = itemInTrx?.namaSohibul || '-';
                    } else {
                        document.getElementById('goatCustomer').textContent = 'Error memuat data';
                        document.getElementById('goatSohibul').textContent = '-';
                    }
                } else {
                    document.getElementById('goatCustomer').textContent = 'Terjual (Tanpa ID Transaksi)';
                    document.getElementById('goatSohibul').textContent = '-';
                }
            } else {
                // SHOW Price if NOT SOLD
                if (priceContainer) {
                    priceContainer.style.display = 'block';
                    const fmtPrice = (typeof window.formatRp === 'function') ? window.formatRp(goat.harga_kandang) : (goat.harga_kandang || '-');
                    document.getElementById('goatPrice').textContent = fmtPrice;
                }
                document.getElementById('goatCustomer').textContent = 'STOK TERSEDIA';
                document.getElementById('goatSohibul').textContent = '-';
            }

            // Photo Fix: Use foto_fisik or foto_thumb and ensure direct link
            const img = document.getElementById('goatPhoto');
            const noPhoto = document.getElementById('goatNoPhoto');
            const rawUrl = goat.foto_fisik || goat.foto_thumb;
            
            if (rawUrl) {
                // Use getDirectDriveLink if available (usually in layout.js or global)
                const finalUrl = (typeof window.getDirectDriveLink === 'function') ? window.getDirectDriveLink(rawUrl) : rawUrl;
                img.src = finalUrl;
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
                    <div class="goat-unit" 
                         data-id="${g.id}" 
                         data-tag="${g.no_tali}" 
                         data-customer="${g._searchContext.customer}" 
                         data-sohibul="${g._searchContext.sohibul}"
                         title="No Tali: ${g.no_tali}" style="${style}">
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
        const cards = document.querySelectorAll('.pen-card');
        
        // Reset all
        cards.forEach(c => c.classList.remove('search-match', 'search-dimmed'));
        units.forEach(u => u.classList.remove('match-highlight'));

        if (!val) return;

        let firstMatchCard = null;

        units.forEach(u => {
            const tag = (u.dataset.tag || '').toLowerCase();
            const cust = (u.dataset.customer || '').toLowerCase();
            const sohib = (u.dataset.sohibul || '').toLowerCase();

            if (tag.includes(val) || cust.includes(val) || sohib.includes(val)) {
                u.classList.add('match-highlight');
                
                // Highlight Parent Card
                const parentCard = u.closest('.pen-card');
                if (parentCard) {
                    parentCard.classList.add('search-match');
                    if (!firstMatchCard) firstMatchCard = parentCard;
                }
            }
        });

        // Dim cards that have no match
        cards.forEach(c => {
            if (!c.classList.contains('search-match')) {
                c.classList.add('search-dimmed');
            }
        });

        // Auto Scroll to first matched card
        if (firstMatchCard) {
            firstMatchCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // Modal Close Logic
    const closeModal = () => document.getElementById('modalGoatDetail').classList.remove('active');
    document.getElementById('btnCloseModalDetail').onclick = closeModal;
    document.getElementById('btnCloseDetail').onclick = closeModal;

    // PHOTO ZOOM LOGIC (Using Global ViewPhoto from layout.js)
    const photoContainer = document.getElementById('goatPhotoContainer');
    photoContainer.onclick = (e) => {
        e.stopPropagation();
        const img = document.getElementById('goatPhoto');
        if (img.style.display !== 'none' && img.src) {
            if (typeof window.viewPhoto === 'function') {
                window.viewPhoto(img.src);
            } else {
                // Fallback if global not available
                window.open(img.src, '_blank');
            }
        }
    };

    window.onclick = (e) => {
        const modal = document.getElementById('modalGoatDetail');
        if (e.target === modal) closeModal();
    };

    btnRefresh.addEventListener('click', loadData);
    loadData();
});

