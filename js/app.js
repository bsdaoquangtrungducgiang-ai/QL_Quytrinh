/**
 * Ứng dụng Quản lý Quy Trình Xét Nghiệm Vi Sinh
 * Khoa Vi Sinh - Bệnh Viện Đa Khoa Đức Giang
 * Tích hợp: Supabase Storage Bucket ('tai-lieu') & Upload Đa Định Dạng (PDF, Word, Excel, Ảnh)
 * Tác giả: BS.CK2. Đào Quang Trung & Đội ngũ CNTT
 */

const BUCKET_NAME = 'tai-lieu';

// Tiện ích loại bỏ dấu tiếng Việt để tìm kiếm thông minh
function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
    str = str.replace(/\u02C6|\u0306|\u031B/g, "");
    return str.trim();
}

// Phân loại định dạng tệp từ tên file
function getFileFormatInfo(filename) {
    if (!filename) return { type: 'pdf', label: 'PDF', icon: '📄', cssClass: 'format-pdf' };
    const ext = filename.split('.').pop().toLowerCase();
    if (['doc', 'docx'].includes(ext)) {
        return { type: 'word', label: 'Word', icon: '📝', cssClass: 'format-word' };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
        return { type: 'excel', label: 'Excel', icon: '📊', cssClass: 'format-excel' };
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
        return { type: 'image', label: 'Ảnh', icon: '🖼️', cssClass: 'format-image' };
    }
    return { type: 'pdf', label: 'PDF', icon: '📄', cssClass: 'format-pdf' };
}

// Chuyển chuỗi thành Storage Key chuẩn ASCII cho Supabase S3
function toSafeStorageKey(text) {
    if (!text) return '';
    return removeVietnameseTones(text)
        .replace(/[^a-zA-Z0-9._/-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// Lấy đường dẫn gọi file từ Supabase Storage hoặc Fallback nội bộ
function getDocumentUrl(proc) {
    if (proc.storageUrl) return proc.storageUrl;
    // Nếu có storageKey chuẩn từ data.js
    if (proc.storageKey) {
        return `${SUPABASE_CONFIG.url}/storage/v1/object/public/${BUCKET_NAME}/${proc.storageKey}`;
    }
    // URL chuẩn trên Supabase Storage
    const safeCategory = toSafeStorageKey(proc.category);
    const safeFilename = toSafeStorageKey(proc.filename);
    const storagePublicUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/${BUCKET_NAME}/${safeCategory}/${safeFilename}`;
    // Nếu chạy local offline có file nội bộ
    if (window.location.protocol === 'file:' && proc.path) {
        return proc.path;
    }
    return storagePublicUrl;
}

// State Quản lý ứng dụng
const AppState = {
    procedures: typeof PROCEDURES_DATA !== 'undefined' ? PROCEDURES_DATA : [],
    filteredProcedures: [],
    selectedCategory: 'all',
    selectedType: 'all',
    selectedFormat: 'all',
    selectedYear: 'all',
    searchQuery: '',
    sortBy: 'code_asc',
    viewMode: 'grid', // 'grid' | 'table'
    charts: {
        categoryChart: null,
        typeChart: null
    },
    tasks: [],
    employees: [],
    selectedUploadFile: null
};

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    loadCustomProcedures();
    initTheme();
    initKPIs();
    initFilterOptions();
    initEventListeners();
    initSidebarNavigation();
    initUploadModal();
    initCharts();
    filterAndRender();
    initSupabaseData();
    checkStorageBucketStatus();
});

// Nạp các tài liệu đã upload thêm trước đó (lưu trong LocalStorage)
function loadCustomProcedures() {
    try {
        const custom = localStorage.getItem('custom_procedures_v1');
        if (custom) {
            const parsed = JSON.parse(custom);
            if (Array.isArray(parsed) && parsed.length > 0) {
                // Thêm vào danh sách chính (tránh trùng id)
                parsed.forEach(cp => {
                    if (!AppState.procedures.some(p => p.id === cp.id)) {
                        AppState.procedures.unshift(cp);
                    }
                });
            }
        }
    } catch (e) {
        console.warn('Lỗi nạp custom procedures:', e);
    }
}

function saveCustomProcedure(newProc) {
    try {
        const custom = JSON.parse(localStorage.getItem('custom_procedures_v1') || '[]');
        custom.unshift(newProc);
        localStorage.setItem('custom_procedures_v1', JSON.stringify(custom));
    } catch (e) {}
}

// 1. Quản lý Theme (Dark / Light)
function initTheme() {
    const savedTheme = localStorage.getItem('theme_mode') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme_mode', next);
            updateThemeIcon(next);
            updateChartTheme();
        });
    }
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    }
}

// 2. Thống kê KPI ban đầu
function initKPIs() {
    const total = AppState.procedures.length;
    const technical = AppState.procedures.filter(p => p.category !== 'Quản Lý Chất Lượng').length;
    const ql = AppState.procedures.filter(p => p.category === 'Quản Lý Chất Lượng').length;
    const recent = AppState.procedures.filter(p => p.year >= 2025).length;

    document.getElementById('statTotalProcedures').textContent = total;
    document.getElementById('statTechProcedures').textContent = technical;
    document.getElementById('statQLProcedures').textContent = ql;
    document.getElementById('statRecentProcedures').textContent = recent;

    // Cập nhật số lượng trên các tab category
    const countAll = total;
    const countQL = ql;
    const countMD = AppState.procedures.filter(p => p.category === 'Miễn Dịch').length;
    const countNC = AppState.procedures.filter(p => p.category === 'Nuôi Cấy').length;
    const countNS = AppState.procedures.filter(p => p.category === 'Nhuộm Soi').length;
    const countPCR = AppState.procedures.filter(p => p.category === 'Sinh Học Phân Tử (PCR)').length;

    const elAll = document.getElementById('pillCountAll'); if (elAll) elAll.textContent = countAll;
    const elQL = document.getElementById('pillCountQL'); if (elQL) elQL.textContent = countQL;
    const elMD = document.getElementById('pillCountMD'); if (elMD) elMD.textContent = countMD;
    const elNC = document.getElementById('pillCountNC'); if (elNC) elNC.textContent = countNC;
    const elNS = document.getElementById('pillCountNS'); if (elNS) elNS.textContent = countNS;
    const elPCR = document.getElementById('pillCountPCR'); if (elPCR) elPCR.textContent = countPCR;

    const navQLBadge = document.querySelector('#navQL .nav-badge'); if (navQLBadge) navQLBadge.textContent = countQL;
    const navNSBadge = document.querySelector('#navNhuomSoi .sub-badge'); if (navNSBadge) navNSBadge.textContent = countNS;
    const navNCBadge = document.querySelector('#navNuoiCay .sub-badge'); if (navNCBadge) navNCBadge.textContent = countNC;
    const navMDBadge = document.querySelector('#navMienDich .sub-badge'); if (navMDBadge) navMDBadge.textContent = countMD;
    const navSHPTBadge = document.querySelector('#navSHPT .sub-badge'); if (navSHPTBadge) navSHPTBadge.textContent = countPCR;
}

// 3. Khởi tạo danh sách bộ lọc Loại quy trình, Định dạng & Năm
function initFilterOptions() {
    const typeSelect = document.getElementById('typeFilterSelect');
    const yearSelect = document.getElementById('yearFilterSelect');

    const types = [...new Set(AppState.procedures.map(p => p.type))].sort();
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
    });

    const years = [...new Set(AppState.procedures.map(p => p.year))].sort((a,b) => b - a);
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `Năm ${y}`;
        yearSelect.appendChild(opt);
    });
}

// 4. Biểu đồ Chart.js (Tone màu Xanh Da Trời)
function initCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded');
        return;
    }

    // Chart 1: Doughnut phân bố theo 5 nhóm chuyên môn
    const catLabels = ['Nuôi Cấy', 'Quản Lý CL', 'Miễn Dịch', 'Nhuộm Soi', 'Sinh Học Phân Tử'];
    const catData = [
        AppState.procedures.filter(p => p.category === 'Nuôi Cấy').length,
        AppState.procedures.filter(p => p.category === 'Quản Lý Chất Lượng').length,
        AppState.procedures.filter(p => p.category === 'Miễn Dịch').length,
        AppState.procedures.filter(p => p.category === 'Nhuộm Soi').length,
        AppState.procedures.filter(p => p.category === 'Sinh Học Phân Tử (PCR)').length
    ];

    const ctxCat = document.getElementById('categoryDoughnutChart');
    if (ctxCat) {
        AppState.charts.categoryChart = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{
                    data: catData,
                    backgroundColor: [
                        '#10b981', // Nuôi cấy - Emerald Green
                        '#ef4444', // QLCL - Rose Red
                        '#6366f1', // Miễn dịch - Indigo
                        '#f59e0b', // Nhuộm soi - Amber
                        '#0284c7'  // PCR - Sky Blue
                    ],
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, font: { size: 12 } }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // Chart 2: Bar chart theo Loại hình quy trình
    const typeCountMap = {};
    AppState.procedures.forEach(p => {
        typeCountMap[p.type] = (typeCountMap[p.type] || 0) + 1;
    });

    const typeLabels = Object.keys(typeCountMap);
    const typeData = Object.values(typeCountMap);

    const ctxType = document.getElementById('typeBarChart');
    if (ctxType) {
        AppState.charts.typeChart = new Chart(ctxType, {
            type: 'bar',
            data: {
                labels: typeLabels,
                datasets: [{
                    label: 'Số lượng quy trình',
                    data: typeData,
                    backgroundColor: '#0284c7',
                    hoverBackgroundColor: '#0369a1',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 5 }
                    },
                    x: {
                        ticks: {
                            font: { size: 10 },
                            maxRotation: 45,
                            minRotation: 20
                        }
                    }
                }
            }
        });
    }
}

function updateChartTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#bae6fd' : '#0369a1';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(2,132,199,0.1)';

    [AppState.charts.categoryChart, AppState.charts.typeChart].forEach(chart => {
        if (!chart) return;
        if (chart.options.scales && chart.options.scales.x) {
            chart.options.scales.x.ticks.color = textColor;
            chart.options.scales.x.grid.color = gridColor;
            chart.options.scales.y.ticks.color = textColor;
            chart.options.scales.y.grid.color = gridColor;
        }
        if (chart.options.plugins && chart.options.plugins.legend) {
            chart.options.plugins.legend.labels.color = textColor;
        }
        chart.update();
    });
}

function updateChartsData() {
    if (AppState.charts.categoryChart) {
        AppState.charts.categoryChart.data.datasets[0].data = [
            AppState.procedures.filter(p => p.category === 'Nuôi Cấy').length,
            AppState.procedures.filter(p => p.category === 'Quản Lý Chất Lượng').length,
            AppState.procedures.filter(p => p.category === 'Miễn Dịch').length,
            AppState.procedures.filter(p => p.category === 'Nhuộm Soi').length,
            AppState.procedures.filter(p => p.category === 'Sinh Học Phân Tử (PCR)').length
        ];
        AppState.charts.categoryChart.update();
    }

    if (AppState.charts.typeChart) {
        const typeCountMap = {};
        AppState.procedures.forEach(p => {
            typeCountMap[p.type] = (typeCountMap[p.type] || 0) + 1;
        });
        AppState.charts.typeChart.data.labels = Object.keys(typeCountMap);
        AppState.charts.typeChart.data.datasets[0].data = Object.values(typeCountMap);
        AppState.charts.typeChart.update();
    }
}

// 5. Khởi tạo Menu chính Phía Bên Trái (Left Sidebar Navigation)
function initSidebarNavigation() {
    const techBtn = document.getElementById('techGroupToggleBtn');
    const techGroup = document.getElementById('techGroup');
    if (techBtn && techGroup) {
        techBtn.addEventListener('click', (e) => {
            e.preventDefault();
            techGroup.classList.toggle('open');
        });
    }

    const navLinks = [
        { id: 'navHome', nav: 'home' },
        { id: 'navQL', nav: 'quan-ly' },
        { id: 'navNhuomSoi', nav: 'nhuom-soi' },
        { id: 'navNuoiCay', nav: 'nuoi-cay' },
        { id: 'navMienDich', nav: 'mien-dich' },
        { id: 'navSHPT', nav: 'sinh-hoc-pt' },
        { id: 'navTimKiem', nav: 'tim-kiem' },
        { id: 'navStorage', nav: 'storage' },
        { id: 'navTasks', nav: 'tasks' }
    ];

    navLinks.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                filterByNav(item.nav);
                closeMobileSidebar();
            });
        }
    });

    const mobileBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('sidebarCloseBtn');
    const backdrop = document.getElementById('sidebarBackdrop');
    const sidebar = document.getElementById('sidebar');

    if (mobileBtn && sidebar && backdrop) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
            backdrop.classList.add('active');
        });
    }

    if (closeBtn && sidebar && backdrop) {
        closeBtn.addEventListener('click', closeMobileSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeMobileSidebar);
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
}

function filterByNav(navKey) {
    document.querySelectorAll('.sidebar-nav .nav-link, .sidebar-nav .nav-sublink').forEach(el => {
        el.classList.remove('active');
    });

    const topbarTitle = document.getElementById('topbarTitle');
    const dashboardSection = document.getElementById('dashboardSection');
    const searchSection = document.getElementById('searchControlsSection');
    const searchInput = document.getElementById('searchInput');

    switch (navKey) {
        case 'home':
            document.getElementById('navHome').classList.add('active');
            topbarTitle.innerHTML = '<span>HỆ THỐNG QUẢN LÝ QUY TRÌNH XÉT NGHIỆM VI SINH</span>';
            dashboardSection.style.display = 'block';
            AppState.selectedCategory = 'all';
            syncPillActive('all');
            filterAndRender();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;

        case 'quan-ly':
            document.getElementById('navQL').classList.add('active');
            topbarTitle.innerHTML = '<span>📋 2. QUY TRÌNH QUẢN LÝ CHẤT LƯỢNG (XN.QL)</span>';
            dashboardSection.style.display = 'block';
            AppState.selectedCategory = 'Quản Lý Chất Lượng';
            syncPillActive('Quản Lý Chất Lượng');
            filterAndRender();
            searchSection.scrollIntoView({ behavior: 'smooth' });
            break;

        case 'tech':
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>🧫 3. QUY TRÌNH KỸ THUẬT XÉT NGHIỆM VI SINH</span>';
            dashboardSection.style.display = 'block';
            AppState.selectedCategory = 'all';
            AppState.searchQuery = 'VS.';
            searchInput.value = 'VS.';
            document.getElementById('searchClearBtn').classList.add('visible');
            filterAndRender();
            searchSection.scrollIntoView({ behavior: 'smooth' });
            break;

        case 'nhuom-soi':
            document.getElementById('navNhuomSoi').classList.add('active');
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>🔬 3.1. QUY TRÌNH NHUỘM SOI (VS.NS)</span>';
            dashboardSection.style.display = 'none';
            AppState.selectedCategory = 'Nhuộm Soi';
            syncPillActive('Nhuộm Soi');
            filterAndRender();
            searchSection.scrollIntoView({ behavior: 'smooth' });
            break;

        case 'nuoi-cay':
            document.getElementById('navNuoiCay').classList.add('active');
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>🦠 3.2. QUY TRÌNH NUÔI CẤY (VS.NC)</span>';
            dashboardSection.style.display = 'none';
            AppState.selectedCategory = 'Nuôi Cấy';
            syncPillActive('Nuôi Cấy');
            filterAndRender();
            searchSection.scrollIntoView({ behavior: 'smooth' });
            break;

        case 'mien-dich':
            document.getElementById('navMienDich').classList.add('active');
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>💉 3.3. QUY TRÌNH MIỄN DỊCH (VS.MD)</span>';
            dashboardSection.style.display = 'none';
            AppState.selectedCategory = 'Miễn Dịch';
            syncPillActive('Miễn Dịch');
            filterAndRender();
            searchSection.scrollIntoView({ behavior: 'smooth' });
            break;

        case 'sinh-hoc-pt':
            document.getElementById('navSHPT').classList.add('active');
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>🧬 3.4. QUY TRÌNH SINH HỌC PHÂN TỬ - PCR (VS.PCR)</span>';
            dashboardSection.style.display = 'none';
            AppState.selectedCategory = 'Sinh Học Phân Tử (PCR)';
            syncPillActive('Sinh Học Phân Tử (PCR)');
            filterAndRender();
            searchSection.scrollIntoView({ behavior: 'smooth' });
            break;

        case 'tim-kiem':
            document.getElementById('navTimKiem').classList.add('active');
            topbarTitle.innerHTML = '<span>🔍 4. TÌM KIẾM THÔNG TIN QUY TRÌNH</span>';
            searchSection.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => {
                searchInput.focus();
                searchInput.select();
            }, 300);
            break;

        case 'storage':
            document.getElementById('navStorage').classList.add('active');
            topbarTitle.innerHTML = '<span>☁️ KHO LƯU TRỮ SUPABASE STORAGE BUCKET</span>';
            const banner = document.getElementById('storageNoticeBanner');
            if (banner) banner.scrollIntoView({ behavior: 'smooth' });
            break;

        case 'tasks':
            document.getElementById('navTasks').classList.add('active');
            topbarTitle.innerHTML = '<span>📝 SỔ GHI NHỚ & PHÂN CÔNG QUY TRÌNH</span>';
            document.getElementById('tasksSection').scrollIntoView({ behavior: 'smooth' });
            break;

        case 'recent':
            topbarTitle.innerHTML = '<span>⚡ CÁC QUY TRÌNH HIỆU LỰC MỚI (2025 - 2026)</span>';
            document.getElementById('yearFilterSelect').value = '2025';
            AppState.selectedYear = '2025';
            filterAndRender();
            searchSection.scrollIntoView({ behavior: 'smooth' });
            break;
    }
}

function syncPillActive(category) {
    document.querySelectorAll('.cat-pill').forEach(pill => {
        pill.classList.toggle('active', pill.getAttribute('data-category') === category);
    });
}

// 6. Tìm kiếm & Lọc Quy Trình
function initEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');

    searchInput.addEventListener('input', (e) => {
        AppState.searchQuery = e.target.value;
        clearBtn.classList.toggle('visible', !!e.target.value);
        filterAndRender();
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        AppState.searchQuery = '';
        clearBtn.classList.remove('visible');
        filterAndRender();
        searchInput.focus();
    });

    document.querySelectorAll('.cat-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const cat = pill.getAttribute('data-category');
            AppState.selectedCategory = cat;
            syncPillActive(cat);

            if (cat === 'all') filterByNav('home');
            else if (cat === 'Quản Lý Chất Lượng') filterByNav('quan-ly');
            else if (cat === 'Nuôi Cấy') filterByNav('nuoi-cay');
            else if (cat === 'Miễn Dịch') filterByNav('mien-dich');
            else if (cat === 'Nhuộm Soi') filterByNav('nhuom-soi');
            else if (cat === 'Sinh Học Phân Tử (PCR)') filterByNav('sinh-hoc-pt');
            else filterAndRender();
        });
    });

    document.getElementById('typeFilterSelect').addEventListener('change', (e) => {
        AppState.selectedType = e.target.value;
        filterAndRender();
    });

    document.getElementById('formatFilterSelect').addEventListener('change', (e) => {
        AppState.selectedFormat = e.target.value;
        filterAndRender();
    });

    document.getElementById('yearFilterSelect').addEventListener('change', (e) => {
        AppState.selectedYear = e.target.value;
        filterAndRender();
    });

    document.getElementById('sortFilterSelect').addEventListener('change', (e) => {
        AppState.sortBy = e.target.value;
        filterAndRender();
    });

    const gridBtn = document.getElementById('viewGridBtn');
    const tableBtn = document.getElementById('viewTableBtn');

    gridBtn.addEventListener('click', () => {
        AppState.viewMode = 'grid';
        gridBtn.classList.add('active');
        tableBtn.classList.remove('active');
        renderProcedures();
    });

    tableBtn.addEventListener('click', () => {
        AppState.viewMode = 'table';
        tableBtn.classList.add('active');
        gridBtn.classList.remove('active');
        renderProcedures();
    });

    document.getElementById('resetFilterBtn').addEventListener('click', () => {
        searchInput.value = '';
        AppState.searchQuery = '';
        clearBtn.classList.remove('visible');
        AppState.selectedCategory = 'all';
        AppState.selectedType = 'all';
        AppState.selectedFormat = 'all';
        AppState.selectedYear = 'all';
        AppState.sortBy = 'code_asc';

        filterByNav('home');
        document.getElementById('typeFilterSelect').value = 'all';
        document.getElementById('formatFilterSelect').value = 'all';
        document.getElementById('yearFilterSelect').value = 'all';
        document.getElementById('sortFilterSelect').value = 'code_asc';

        filterAndRender();
    });

    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('detailModalBackdrop').addEventListener('click', (e) => {
        if (e.target.id === 'detailModalBackdrop') closeModal();
    });

    // Add Task Modal
    document.getElementById('openAddTaskModalBtn').addEventListener('click', () => {
        document.getElementById('addTaskModalBackdrop').classList.add('active');
    });
    document.getElementById('closeAddTaskModalBtn').addEventListener('click', () => {
        document.getElementById('addTaskModalBackdrop').classList.remove('active');
    });
    document.getElementById('addTaskModalBackdrop').addEventListener('click', (e) => {
        if (e.target.id === 'addTaskModalBackdrop') {
            document.getElementById('addTaskModalBackdrop').classList.remove('active');
        }
    });

    document.getElementById('addTaskForm').addEventListener('submit', handleAddTaskSubmit);
}

function filterAndRender() {
    const rawQuery = removeVietnameseTones(AppState.searchQuery.trim());

    AppState.filteredProcedures = AppState.procedures.filter(p => {
        if (AppState.selectedCategory !== 'all' && p.category !== AppState.selectedCategory) {
            return false;
        }
        if (AppState.selectedType !== 'all' && p.type !== AppState.selectedType) {
            return false;
        }
        if (AppState.selectedFormat !== 'all') {
            const fmt = getFileFormatInfo(p.filename);
            if (fmt.type !== AppState.selectedFormat) return false;
        }
        if (AppState.selectedYear !== 'all' && p.year.toString() !== AppState.selectedYear.toString()) {
            return false;
        }
        if (rawQuery) {
            const rawTitle = removeVietnameseTones(p.title);
            const rawCode = removeVietnameseTones(p.code);
            const rawFilename = removeVietnameseTones(p.filename);
            const rawCategory = removeVietnameseTones(p.category);
            const rawType = removeVietnameseTones(p.type);

            const match = rawTitle.includes(rawQuery) ||
                          rawCode.includes(rawQuery) ||
                          rawFilename.includes(rawQuery) ||
                          rawCategory.includes(rawQuery) ||
                          rawType.includes(rawQuery);
            if (!match) return false;
        }
        return true;
    });

    AppState.filteredProcedures.sort((a, b) => {
        if (AppState.sortBy === 'code_asc') return a.code.localeCompare(b.code);
        if (AppState.sortBy === 'code_desc') return b.code.localeCompare(a.code);
        if (AppState.sortBy === 'title_asc') return a.title.localeCompare(b.title);
        if (AppState.sortBy === 'year_desc') return b.year - a.year;
        if (AppState.sortBy === 'year_asc') return a.year - b.year;
        return 0;
    });

    renderProcedures();
}

function getCategoryBadgeClass(category) {
    switch (category) {
        case 'Quản Lý Chất Lượng': return 'badge-ql';
        case 'Miễn Dịch': return 'badge-md';
        case 'Nuôi Cấy': return 'badge-nc';
        case 'Nhuộm Soi': return 'badge-ns';
        case 'Sinh Học Phân Tử (PCR)': return 'badge-pcr';
        default: return '';
    }
}

function renderProcedures() {
    const gridContainer = document.getElementById('proceduresGrid');
    const tableContainer = document.getElementById('proceduresTableWrapper');
    const countElement = document.getElementById('resultsCount');

    countElement.textContent = `Hiển thị ${AppState.filteredProcedures.length} / ${AppState.procedures.length} quy trình`;

    if (AppState.filteredProcedures.length === 0) {
        gridContainer.style.display = 'none';
        tableContainer.style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        return;
    }

    document.getElementById('emptyState').style.display = 'none';

    if (AppState.viewMode === 'grid') {
        gridContainer.style.display = 'grid';
        tableContainer.style.display = 'none';

        gridContainer.innerHTML = AppState.filteredProcedures.map(p => {
            const fmt = getFileFormatInfo(p.filename);
            const fileUrl = getDocumentUrl(p);

            return `
                <div class="proc-card" id="proc-card-${p.id}">
                    <div>
                        <div class="proc-card-header">
                            <span class="sop-code">${p.code || 'SOP'}</span>
                            <div style="display:flex; gap:6px; align-items:center">
                                <span class="format-badge ${fmt.cssClass}">${fmt.icon} ${fmt.label}</span>
                                <span class="proc-badge ${getCategoryBadgeClass(p.category)}">${p.category}</span>
                            </div>
                        </div>
                        <div class="proc-card-body">
                            <h4 class="proc-title" title="${p.title}">${p.title}</h4>
                            <div class="proc-meta">
                                <span class="proc-meta-item">📁 ${p.type}</span>
                                <span class="proc-meta-item">📅 Năm ${p.year}</span>
                                <span class="proc-meta-item">💾 ${p.sizeFormatted}</span>
                            </div>
                        </div>
                    </div>
                    <div class="proc-card-footer">
                        <a href="${fileUrl}" target="_blank" class="btn btn-primary btn-sm" style="flex:1" title="Xem hoặc tải tệp từ Supabase Storage">
                            ${fmt.icon} Mở Tài Liệu
                        </a>
                        <button onclick="openProcedureDetail(${p.id})" class="btn btn-outline btn-sm">
                            🔍 Chi tiết
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        gridContainer.style.display = 'none';
        tableContainer.style.display = 'block';

        const tbody = document.getElementById('proceduresTableBody');
        tbody.innerHTML = AppState.filteredProcedures.map(p => {
            const fmt = getFileFormatInfo(p.filename);
            const fileUrl = getDocumentUrl(p);

            return `
                <tr id="proc-row-${p.id}">
                    <td style="font-weight:700; font-family:monospace">${p.code || 'SOP'}</td>
                    <td style="font-weight:600">${p.title}</td>
                    <td><span class="proc-badge ${getCategoryBadgeClass(p.category)}">${p.category}</span></td>
                    <td>${p.type}</td>
                    <td><span class="format-badge ${fmt.cssClass}">${fmt.icon} ${fmt.label}</span></td>
                    <td><span style="font-weight:600">${p.year}</span></td>
                    <td>
                        <div style="display:flex; gap:6px">
                            <a href="${fileUrl}" target="_blank" class="btn btn-primary btn-sm" title="Xem tệp">
                                ${fmt.icon} Mở
                            </a>
                            <button onclick="openProcedureDetail(${p.id})" class="btn btn-outline btn-sm" title="Xem chi tiết">
                                🔍
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// 7. Modal Chi tiết Quy Trình
function openProcedureDetail(procId) {
    const p = AppState.procedures.find(item => item.id === procId);
    if (!p) return;

    const fmt = getFileFormatInfo(p.filename);
    const fileUrl = getDocumentUrl(p);

    document.getElementById('modalSopCode').textContent = p.code || 'SOP';
    document.getElementById('modalTitle').textContent = p.title;
    document.getElementById('modalCategory').textContent = p.category;
    document.getElementById('modalType').textContent = p.type;
    document.getElementById('modalYear').textContent = `Năm ${p.year}`;
    document.getElementById('modalDepartment').textContent = p.department;
    document.getElementById('modalLead').textContent = p.lead;
    document.getElementById('modalFilename').textContent = p.filename;
    document.getElementById('modalSize').textContent = p.sizeFormatted;

    const openPdfBtn = document.getElementById('modalOpenPdfBtn');
    openPdfBtn.href = fileUrl;
    openPdfBtn.innerHTML = `${fmt.icon} Mở Toàn Văn (${fmt.label})`;

    document.getElementById('detailModalBackdrop').classList.add('active');
}

function closeModal() {
    document.getElementById('detailModalBackdrop').classList.remove('active');
}

// 8. TÍNH NĂNG TẢI TÀI LIỆU MỚI LÊN SUPABASE STORAGE
function initUploadModal() {
    const openBtns = [document.getElementById('sidebarUploadBtn'), document.getElementById('topbarUploadBtn')];
    const modalBackdrop = document.getElementById('uploadDocModalBackdrop');
    const closeBtn = document.getElementById('closeUploadModalBtn');
    const cancelBtn = document.getElementById('cancelUploadBtn');
    const form = document.getElementById('uploadDocForm');
    const fileInput = document.getElementById('uploadFileInput');
    const dropZone = document.getElementById('fileDropZone');
    const dropzoneContent = document.getElementById('dropzoneContent');
    const selectedFilePreview = document.getElementById('selectedFilePreview');
    const removeFileBtn = document.getElementById('removeFileBtn');

    openBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                modalBackdrop.classList.add('active');
            });
        }
    });

    function closeUploadModal() {
        modalBackdrop.classList.remove('active');
        form.reset();
        AppState.selectedUploadFile = null;
        dropzoneContent.style.display = 'block';
        selectedFilePreview.style.display = 'none';
        document.getElementById('uploadProgressBarWrapper').style.display = 'none';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeUploadModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeUploadModal);
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target.id === 'uploadDocModalBackdrop') closeUploadModal();
        });
    }

    // Dropzone interaction
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', (e) => {
            if (e.target.id !== 'removeFileBtn') {
                fileInput.click();
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFileSelected(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFileSelected(e.target.files[0]);
            }
        });
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            AppState.selectedUploadFile = null;
            fileInput.value = '';
            dropzoneContent.style.display = 'block';
            selectedFilePreview.style.display = 'none';
        });
    }

    function handleFileSelected(file) {
        AppState.selectedUploadFile = file;
        const fmt = getFileFormatInfo(file.name);
        document.getElementById('previewFileIcon').textContent = fmt.icon;
        document.getElementById('previewFileName').textContent = file.name;
        const sizeFormatted = file.size > 1024*1024 ? `${(file.size/(1024*1024)).toFixed(2)} MB` : `${(file.size/1024).toFixed(0)} KB`;
        document.getElementById('previewFileSize').textContent = sizeFormatted;

        dropzoneContent.style.display = 'none';
        selectedFilePreview.style.display = 'flex';

        // Tự động điền gợi ý tên tài liệu nếu chưa nhập
        const titleInput = document.getElementById('uploadTitleInput');
        if (!titleInput.value.trim()) {
            let suggestedTitle = file.name.replace(/\.[^/.]+$/, "");
            suggestedTitle = suggestedTitle.replace(/^[-_\s]+|[-_\s]+$/g, "");
            titleInput.value = suggestedTitle.toUpperCase();
        }
    }

    // Submit Upload Form
    if (form) {
        form.addEventListener('submit', handleUploadSubmit);
    }
}

async function handleUploadSubmit(e) {
    e.preventDefault();

    if (!AppState.selectedUploadFile) {
        alert('Vui lòng chọn tệp tin cần tải lên (PDF, Word, Excel hoặc Ảnh).');
        return;
    }

    const title = document.getElementById('uploadTitleInput').value.trim();
    const code = document.getElementById('uploadCodeInput').value.trim();
    const year = parseInt(document.getElementById('uploadYearInput').value) || 2026;
    const category = document.getElementById('uploadCategorySelect').value;
    const type = document.getElementById('uploadTypeSelect').value;
    const file = AppState.selectedUploadFile;

    const progressWrapper = document.getElementById('uploadProgressBarWrapper');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressPercent = document.getElementById('uploadProgressPercent');
    const submitBtn = document.getElementById('submitUploadBtn');

    progressWrapper.style.display = 'block';
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Đang tải lên Supabase...';

    // Tạo đường dẫn chuẩn ASCII trong bucket Supabase Storage: [Category]/[filename]
    const safeCategory = toSafeStorageKey(category);
    const safeFilename = toSafeStorageKey(file.name);
    const remotePath = `${safeCategory}/${Date.now()}_${safeFilename}`;

    let uploadedStorageUrl = '';
    const client = getSupabase();

    if (client) {
        try {
            progressBar.style.width = '40%';
            progressPercent.textContent = '40%';

            // Tải file lên Supabase Storage
            const { data, error } = await client.storage
                .from(BUCKET_NAME)
                .upload(remotePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.warn('Lỗi Supabase Storage upload, dùng public url chuẩn:', error);
            }

            progressBar.style.width = '80%';
            progressPercent.textContent = '80%';

            // Lấy URL công khai
            const { data: publicUrlData } = client.storage
                .from(BUCKET_NAME)
                .getPublicUrl(remotePath);

            uploadedStorageUrl = publicUrlData ? publicUrlData.publicUrl : `${SUPABASE_CONFIG.url}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(remotePath)}`;

        } catch (err) {
            console.error('Lỗi khi tải lên Supabase Storage:', err);
            uploadedStorageUrl = URL.createObjectURL(file);
        }
    } else {
        uploadedStorageUrl = URL.createObjectURL(file);
    }

    progressBar.style.width = '100%';
    progressPercent.textContent = '100%';

    // Tạo đối tượng tài liệu mới
    const sizeMb = file.size / (1024 * 1024);
    const sizeFormatted = sizeMb >= 1 ? `${sizeMb.toFixed(2)} MB` : `${(file.size / 1024).toFixed(0)} KB`;

    const newProc = {
        id: Date.now(),
        code: code || 'SOP.NEW',
        title: title.toUpperCase(),
        category: category,
        type: type,
        year: year,
        filename: file.name,
        path: uploadedStorageUrl,
        storageUrl: uploadedStorageUrl,
        sizeFormatted: sizeFormatted,
        department: category === 'Quản Lý Chất Lượng' ? 'Khối Xét Nghiệm • BVĐK Đức Giang' : 'Khoa Vi Sinh • BVĐK Đức Giang',
        lead: 'BS.CK2. Đào Quang Trung'
    };

    // Đưa vào State đầu danh sách
    AppState.procedures.unshift(newProc);
    saveCustomProcedure(newProc);

    // Cập nhật lại số lượng và biểu đồ
    initKPIs();
    updateChartsData();
    filterAndRender();

    // Đóng modal và reset
    setTimeout(() => {
        document.getElementById('uploadDocModalBackdrop').classList.remove('active');
        document.getElementById('uploadDocForm').reset();
        progressWrapper.style.display = 'none';
        progressBar.style.width = '0%';
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 Tải Lên & Lưu Vào Kho';
        AppState.selectedUploadFile = null;

        showToast(`✅ Đã tải lên thành công: "${title}" vào kho "${category}"!`);

        // Lọc ngay đến nhóm vừa thêm và cuộn tới
        AppState.selectedCategory = category;
        syncPillActive(category);
        filterAndRender();
        const firstCard = document.querySelector('.proc-card');
        if (firstCard) {
            firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstCard.style.outline = '3px solid var(--primary)';
            setTimeout(() => { firstCard.style.outline = 'none'; }, 2500);
        }
    }, 500);
}

// Toast Thông báo
function showToast(msg) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3500);
}

// 9. Kiểm tra trạng thái Bucket Supabase Storage
async function checkStorageBucketStatus() {
    const client = getSupabase();
    const statusText = document.getElementById('bucketStatusText');
    if (!client || !statusText) return;

    try {
        const { data, error } = await client.storage.getBucket(BUCKET_NAME);
        if (data && !error) {
            statusText.textContent = `${BUCKET_NAME} (Active)`;
            statusText.style.color = 'var(--success)';
        } else {
            statusText.textContent = `${BUCKET_NAME} (Ready)`;
        }
    } catch (e) {
        statusText.textContent = `${BUCKET_NAME}`;
    }
}

// 10. Đồng Bộ & Tương Tác Dữ Liệu Supabase (Tasks)
async function initSupabaseData() {
    const client = getSupabase();
    const badge = document.getElementById('supabaseSidebarBadge');
    
    if (!client) {
        if (badge) badge.innerHTML = '<span class="pulse-dot" style="background-color:#f59e0b"></span> Local Mode';
        loadTasksFromLocalStorage();
        return;
    }

    try {
        const { data: empData, error: empErr } = await client
            .from('employees')
            .select('*')
            .eq('active', true);
            
        if (!empErr && empData && empData.length > 0) {
            AppState.employees = empData;
            populateAssigneeSelect(empData);
        } else {
            AppState.employees = [
                { name: 'BS.CK2. Đào Quang Trung', position: 'Trưởng khoa Vi sinh' },
                { name: 'BS. Chu Thị Huyền', position: 'Bác sĩ Vi sinh' }
            ];
            populateAssigneeSelect(AppState.employees);
        }

        await fetchTasksFromSupabase();

        if (badge) {
            badge.innerHTML = '<span class="pulse-dot"></span> Supabase Connected';
        }
    } catch (err) {
        console.error('Lỗi khi kết nối Supabase:', err);
        if (badge) badge.innerHTML = '<span class="pulse-dot" style="background-color:#f59e0b"></span> Offline Mode';
        loadTasksFromLocalStorage();
    }
}

function populateAssigneeSelect(employees) {
    const select = document.getElementById('taskAssigneeSelect');
    if (!select) return;
    select.innerHTML = employees.map(e => `<option value="${e.name}">${e.name} (${e.position || 'Khoa Vi sinh'})</option>`).join('');
}

async function fetchTasksFromSupabase() {
    const client = getSupabase();
    if (!client) return;

    try {
        const { data, error } = await client
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        AppState.tasks = data || [];
        renderTasks();
    } catch (err) {
        console.error('Lỗi tải tasks từ Supabase:', err);
        loadTasksFromLocalStorage();
    }
}

function renderTasks() {
    const container = document.getElementById('tasksListContainer');
    if (!container) return;

    if (AppState.tasks.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:30px 10px; color:var(--text-muted)">
                <p>Chưa có ghi nhớ hoặc nhiệm vụ quy trình nào được lưu trên Supabase.</p>
                <p style="font-size:12px; margin-top:4px">Bấm <strong>"+ Thêm Ghi Nhớ Quy Trình"</strong> ở trên để tạo nhiệm vụ rà soát hoặc phân công.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = AppState.tasks.map(t => {
        let statusClass = 'status-todo';
        if (t.status === 'Đã hoàn thành') statusClass = 'status-done';
        else if (t.status === 'Đang thực hiện') statusClass = 'status-progress';

        return `
            <div class="task-item">
                <div class="task-info">
                    <div class="task-title">${t.Title || t.title || 'Nhiệm vụ'}</div>
                    <div class="task-meta">
                        <span>👤 ${t.assignee || 'BS.CK2. Đào Quang Trung'}</span>
                        <span>📅 Hạn: ${t.due_date || 'Không có'}</span>
                        <span>📊 Tiến độ: ${t.progress || 0}%</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px">
                    <span class="task-status ${statusClass}">${t.status || 'Chờ thực hiện'}</span>
                    <button onclick="handleDeleteTask(${t.id})" class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger)" title="Xoá ghi nhớ">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function handleAddTaskSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('taskTitleInput').value.trim();
    const assignee = document.getElementById('taskAssigneeSelect').value;
    const dueDate = document.getElementById('taskDueDateInput').value;
    const status = document.getElementById('taskStatusSelect').value;
    const progress = parseInt(document.getElementById('taskProgressInput').value) || 0;

    if (!title) return;

    const client = getSupabase();
    const newTask = {
        Title: title,
        assignee: assignee,
        due_date: dueDate || null,
        status: status,
        progress: progress
    };

    if (client) {
        try {
            const { data, error } = await client
                .from('tasks')
                .insert([newTask])
                .select();

            if (error) throw error;
            if (data && data[0]) {
                AppState.tasks.unshift(data[0]);
            }
        } catch (err) {
            console.error('Lỗi khi ghi task vào Supabase:', err);
            newTask.id = Date.now();
            newTask.created_at = new Date().toISOString();
            AppState.tasks.unshift(newTask);
            saveTasksToLocalStorage();
        }
    } else {
        newTask.id = Date.now();
        newTask.created_at = new Date().toISOString();
        AppState.tasks.unshift(newTask);
        saveTasksToLocalStorage();
    }

    renderTasks();
    document.getElementById('addTaskModalBackdrop').classList.remove('active');
    document.getElementById('addTaskForm').reset();
}

async function handleDeleteTask(taskId) {
    if (!confirm('Bạn có chắc chắn muốn xóa ghi nhớ này khỏi Supabase?')) return;

    const client = getSupabase();
    if (client) {
        try {
            const { error } = await client
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;
        } catch (err) {
            console.error('Lỗi xoá task trên Supabase:', err);
        }
    }

    AppState.tasks = AppState.tasks.filter(t => t.id !== taskId);
    saveTasksToLocalStorage();
    renderTasks();
}

function loadTasksFromLocalStorage() {
    try {
        const saved = localStorage.getItem('sop_tasks_cache');
        if (saved) {
            AppState.tasks = JSON.parse(saved);
        }
    } catch (e) {}
    renderTasks();
}

function saveTasksToLocalStorage() {
    try {
        localStorage.setItem('sop_tasks_cache', JSON.stringify(AppState.tasks));
    } catch (e) {}
}
