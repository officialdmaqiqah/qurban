import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const featuredGrid = document.getElementById('featuredGoats');
    const heroConsultBtn = document.getElementById('heroConsultBtn');
    const footerWa = document.getElementById('footerWa');
    const floatingWa = document.getElementById('floatingWa');
    const navToggle = document.getElementById('navToggle');
    const sidebarMenu = document.getElementById('sidebarMenu');
    
    // 1. Affiliate & Contact Sync
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    let currentAgent = {
        name: 'Mimin Qurban',
        wa: '6285335150001',
        isAffiliate: false
    };

    if (ref) await lookupAgent(ref.toLowerCase());
    else syncContactUI(); // Initial sync for default admin

    async function lookupAgent(username) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, wa, email')
                .or(`email.ilike.${username},email.ilike.${username}@%`)
                .limit(1)
                .maybeSingle();

            if (data && !error && data.wa) {
                let wa = data.wa.replace(/\D/g, '');
                if (wa.startsWith('0')) wa = '62' + wa.substring(1);
                else if (wa.startsWith('8')) wa = '62' + wa;

                currentAgent = {
                    name: data.full_name,
                    wa: wa,
                    isAffiliate: true
                };
            }
        } catch (e) {
            console.error('Affiliate lookup failed', e);
        } finally {
            syncContactUI();
        }
    }

    function syncContactUI() {
        const waLink = `https://wa.me/${currentAgent.wa}?text=Halo ${currentAgent.name}, saya ingin bertanya tentang Qurban.`;
        
        if (heroConsultBtn) heroConsultBtn.href = waLink;
        if (floatingWa) floatingWa.href = waLink;
        
        if (footerWa) {
            const formatted = currentAgent.wa.startsWith('62') ? '0' + currentAgent.wa.slice(2) : currentAgent.wa;
            footerWa.textContent = formatted.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
        }
    }

    // 2. Mobile Menu Toggle
    if (navToggle && sidebarMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            sidebarMenu.classList.toggle('active');
        });

        // Close when clicking links
        sidebarMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                sidebarMenu.classList.remove('active');
            });
        });
    }

    // 3. Scroll Reveal Animations
    const observerOptions = { threshold: 0.1 };
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    // Apply reveal to sections
    document.querySelectorAll('section, .feature-card, .section-header').forEach(el => {
        el.classList.add('reveal');
        revealObserver.observe(el);
    });

    // 4. Fetch Featured Stock
    async function fetchFeaturedGoats() {
        if (!featuredGrid) return;
        featuredGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #94a3b8;">Memuat Stok Unggulan...</div>';

        const { data, error } = await supabase
            .from('stok_kambing')
            .select('*')
            .eq('status_transaksi', 'Tersedia')
            .limit(3)
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            featuredGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #94a3b8;">Belum ada stok tersedia.</div>';
            return;
        }

        renderFeatured(data);
    }

    function cleanGoogleDriveUrl(url) {
        if (!url) return '';
        const matches = (url || '').match(/[-\w]{25,50}/g);
        if (matches) {
            const longest = matches.reduce((a, b) => a.length > b.length ? a : b);
            return `https://drive.google.com/thumbnail?id=${longest}&sz=w800`;
        }
        return url;
    }

    function renderFeatured(goats) {
        if (!featuredGrid) return;
        featuredGrid.innerHTML = '';
        goats.forEach(goat => {
            const card = document.createElement('div');
            card.className = 'goat-card reveal';
            
            const rawImg = goat.foto_thumb || goat.foto_fisik;
            const goatImg = cleanGoogleDriveUrl(rawImg);
            const tagNum = goat.no_tali || '??';
            const fallbackImg = `https://ui-avatars.com/api/?name=${tagNum}&background=random&color=fff&size=512`;
            const finalImg = goatImg || fallbackImg;
            
            let category = 'Reguler';
            if (goat.harga_kandang > 5000000) category = 'Premium';
            else if (goat.harga_kandang > 3500000) category = 'Super';

            const etalaseUrl = ref ? `etalase.html?ref=${ref}` : 'etalase.html';

            card.innerHTML = `
                <div class="goat-img">
                    <img src="${finalImg}" alt="Goat ${tagNum}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${fallbackImg}'">
                    <span class="goat-badge">${category}</span>
                </div>
                <div class="goat-info">
                    <div class="goat-title">Tag #${tagNum} - ${goat.warna_tali || 'Kambing Qurban'}</div>
                    <div class="goat-meta">
                        <span>Sehat & Terawat</span>
                    </div>
                    <a href="${etalaseUrl}" class="btn-premium" style="width:100%; font-size: 0.85rem; justify-content:center;">Cek Detail</a>
                </div>
            `;
            featuredGrid.appendChild(card);
            revealObserver.observe(card);
        });
    }

    fetchFeaturedGoats();
});
