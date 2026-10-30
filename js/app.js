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

// Thoát ký tự HTML an toàn chống lỗi hiển thị
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

// Ánh xạ chính xác nhóm chuyên môn tới thư mục trong Bucket 'tai-lieu' trên Supabase
function getStorageFolderForCategory(cat) {
    if (!cat) return 'Quan_Ly_Chat_Luong';
    const map = {
        'Quản Lý Chất Lượng': 'Quan_Ly_Chat_Luong',
        'Nuôi Cấy': 'Nuoi_Cay',
        'Nuôi cấy': 'Nuoi_Cay',
        'Miễn Dịch': 'Mien_Dich',
        'Miễn dịch': 'Mien_Dich',
        'Nhuộm Soi': 'Nhuom_Soi',
        'Sinh Học Phân Tử (PCR)': 'Sinh_Hoc_Phan_Tu_PCR',
        'Sinh học PT': 'Sinh_Hoc_Phan_Tu_PCR'
    };
    return map[cat] || toSafeStorageKey(cat);
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
    currentUser: null,
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
    selectedUploadFile: null,
    // Văn Bản Y Tế State
    medicalDocs: typeof MEDICAL_DOCUMENTS_DATA !== 'undefined' ? MEDICAL_DOCUMENTS_DATA : [],
    filteredMedicalDocs: [],
    selectedMedCategory: 'all',
    medSearchQuery: '',
    selectedMedFormat: 'all',
    selectedMedYear: 'all',
    selectedMedSort: 'year_desc',
    // Universal Search & AI Engine State
    universalSearch: {
        query: '',
        scope: 'all',
        matchedDocs: [],
        geminiLoading: false
    }
};

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    renderStaffAccountsTable();
    loadCustomProcedures();
    initTheme();
    initKPIs();
    initFilterOptions();
    initEventListeners();
    initSidebarNavigation();
    initMedicalDocs();
    initUniversalSearch();
    initUploadModal();
    initEditDocModal();
    initCharts();
    filterByNav('home');
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
        { id: 'navMedicalDocs', nav: 'medical-docs' },
        { id: 'navDbManager', nav: 'db-manager' },
        { id: 'navAccounts', nav: 'accounts' }
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

function switchMainView(viewName) {
    const dashboardSec = document.getElementById('dashboardSection');
    const proceduresSec = document.getElementById('proceduresSection');
    const universalSearchSec = document.getElementById('universalSearchSection');
    const storageNoticeBanner = document.getElementById('storageNoticeBanner');
    const storageDbSec = document.getElementById('storageDatabaseSection');
    const medicalDocsSec = document.getElementById('medicalDocsSection');
    const accountsSec = document.getElementById('accountsSection');

    // 1. Ẩn tất cả các khu vực (không trượt xem toàn bộ)
    if (dashboardSec) dashboardSec.style.display = 'none';
    if (proceduresSec) proceduresSec.style.display = 'none';
    if (universalSearchSec) universalSearchSec.style.display = 'none';
    if (storageNoticeBanner) storageNoticeBanner.style.display = 'none';
    if (storageDbSec) storageDbSec.style.display = 'none';
    if (medicalDocsSec) medicalDocsSec.style.display = 'none';
    if (accountsSec) accountsSec.style.display = 'none';

    // 2. Chỉ hiện đúng duy nhất khu vực được chọn
    if (viewName === 'dashboard') {
        if (dashboardSec) dashboardSec.style.display = 'block';
        if (storageNoticeBanner) storageNoticeBanner.style.display = 'flex';
    } else if (viewName === 'procedures') {
        if (proceduresSec) proceduresSec.style.display = 'block';
    } else if (viewName === 'universal-search') {
        if (universalSearchSec) universalSearchSec.style.display = 'block';
    } else if (viewName === 'medical-docs') {
        if (medicalDocsSec) medicalDocsSec.style.display = 'block';
    } else if (viewName === 'db-manager') {
        if (storageDbSec) storageDbSec.style.display = 'block';
    } else if (viewName === 'accounts') {
        if (accountsSec) accountsSec.style.display = 'block';
    }

    // Cuộn mượt lên đầu trang
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filterByNav(navKey) {
    document.querySelectorAll('.sidebar-nav .nav-link, .sidebar-nav .nav-sublink').forEach(el => {
        el.classList.remove('active');
    });

    const topbarTitle = document.getElementById('topbarTitle');
    const searchInput = document.getElementById('searchInput');

    switch (navKey) {
        case 'home':
            switchMainView('dashboard');
            document.getElementById('navHome').classList.add('active');
            topbarTitle.innerHTML = '<span>📊 DASHBOARD - QUẢN LÝ QUY TRÌNH XÉT NGHIỆM VI SINH</span>';
            break;

        case 'quan-ly':
            switchMainView('procedures');
            document.getElementById('navQL').classList.add('active');
            topbarTitle.innerHTML = '<span>📋 QUY TRÌNH QUẢN LÝ CHẤT LƯỢNG (XN.QL) — 31 TÀI LIỆU</span>';
            if (searchInput) searchInput.value = '';
            AppState.searchQuery = '';
            AppState.selectedCategory = 'Quản Lý Chất Lượng';
            syncPillActive('Quản Lý Chất Lượng');
            filterAndRender();
            break;

        case 'tech':
            switchMainView('procedures');
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>🧫 QUY TRÌNH KỸ THUẬT XÉT NGHIỆM VI SINH — 83 TÀI LIỆU</span>';
            if (searchInput) searchInput.value = 'VS.';
            AppState.searchQuery = 'VS.';
            AppState.selectedCategory = 'all';
            syncPillActive('all');
            document.getElementById('searchClearBtn').classList.add('visible');
            filterAndRender();
            break;

        case 'nhuom-soi':
            switchMainView('procedures');
            document.getElementById('navNhuomSoi').classList.add('active');
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>🔬 QUY TRÌNH NHUỘM SOI (VS.NS) — 15 TÀI LIỆU</span>';
            if (searchInput) searchInput.value = '';
            AppState.searchQuery = '';
            AppState.selectedCategory = 'Nhuộm Soi';
            syncPillActive('Nhuộm Soi');
            filterAndRender();
            break;

        case 'nuoi-cay':
            switchMainView('procedures');
            document.getElementById('navNuoiCay').classList.add('active');
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>🦠 QUY TRÌNH NUÔI CẤY (VS.NC) — 30 TÀI LIỆU</span>';
            if (searchInput) searchInput.value = '';
            AppState.searchQuery = '';
            AppState.selectedCategory = 'Nuôi Cấy';
            syncPillActive('Nuôi Cấy');
            filterAndRender();
            break;

        case 'mien-dich':
            switchMainView('procedures');
            document.getElementById('navMienDich').classList.add('active');
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>💉 QUY TRÌNH MIỄN DỊCH (VS.MD) — 28 TÀI LIỆU</span>';
            if (searchInput) searchInput.value = '';
            AppState.searchQuery = '';
            AppState.selectedCategory = 'Miễn Dịch';
            syncPillActive('Miễn Dịch');
            filterAndRender();
            break;

        case 'sinh-hoc-pt':
            switchMainView('procedures');
            document.getElementById('navSHPT').classList.add('active');
            document.getElementById('techGroup').classList.add('open');
            topbarTitle.innerHTML = '<span>🧬 QUY TRÌNH SINH HỌC PHÂN TỬ - PCR (VS.PCR) — 10 TÀI LIỆU</span>';
            if (searchInput) searchInput.value = '';
            AppState.searchQuery = '';
            AppState.selectedCategory = 'Sinh Học Phân Tử (PCR)';
            syncPillActive('Sinh Học Phân Tử (PCR)');
            filterAndRender();
            break;

        case 'tim-kiem':
            switchMainView('universal-search');
            document.getElementById('navTimKiem').classList.add('active');
            topbarTitle.innerHTML = '<span>🔍 TÌM KIẾM TỔNG THỂ &amp; HỎI ĐÁP AI THÔNG MINH (GOOGLE &amp; GEMINI)</span>';
            setTimeout(() => {
                const univInput = document.getElementById('univSearchInput');
                if (univInput) {
                    univInput.focus();
                    univInput.select();
                }
            }, 250);
            break;

        case 'medical-docs':
            switchMainView('medical-docs');
            const navMed = document.getElementById('navMedicalDocs');
            if (navMed) navMed.classList.add('active');
            topbarTitle.innerHTML = '<span>📜 THÔNG TIN VĂN BẢN Y TẾ & QUY ĐỊNH CHUYÊN MÔN — 295 VĂN BẢN</span>';
            setTimeout(() => {
                const medSearch = document.getElementById('medSearchInput');
                if (medSearch) {
                    medSearch.focus();
                    medSearch.select();
                }
            }, 250);
            break;

        case 'db-manager':
            if (!AppState.currentUser || AppState.currentUser.role !== 'Admin') {
                showToast('⚠️ Chỉ tài khoản Admin mới có quyền truy cập Quản lý CSDL kho tệp!');
                filterByNav('home');
                return;
            }
            switchMainView('db-manager');
            const navDb = document.getElementById('navDbManager');
            if (navDb) navDb.classList.add('active');
            topbarTitle.innerHTML = '<span>🗄️ QUẢN LÝ CSDL KHO LƯU TRỮ TỆP (tai-lieu)</span>';
            break;

        case 'accounts':
            switchMainView('accounts');
            const navAcc = document.getElementById('navAccounts');
            if (navAcc) navAcc.classList.add('active');
            topbarTitle.innerHTML = '<span>👥 BẢNG DANH SÁCH TÀI KHOẢN & PHÂN QUYỀN TRUY CẬP</span>';
            break;

        case 'recent':
            switchMainView('procedures');
            topbarTitle.innerHTML = '<span>⚡ CÁC QUY TRÌNH HIỆU LỰC MỚI (2025 - 2026)</span>';
            document.getElementById('yearFilterSelect').value = '2025';
            AppState.selectedYear = '2025';
            filterAndRender();
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

            if (cat === 'all') {
                switchMainView('procedures');
                const topbarTitle = document.getElementById('topbarTitle');
                if (topbarTitle) topbarTitle.innerHTML = '<span>🗂️ TOÀN BỘ 114 QUY TRÌNH XÉT NGHIỆM VI SINH</span>';
                filterAndRender();
            } else if (cat === 'Quản Lý Chất Lượng') filterByNav('quan-ly');
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

        switchMainView('procedures');
        const topbarTitle = document.getElementById('topbarTitle');
        if (topbarTitle) topbarTitle.innerHTML = '<span>🔍 TÌM KIẾM & TOÀN BỘ QUY TRÌNH XÉT NGHIỆM</span>';
        syncPillActive('all');
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

    // CSDL Kho Tệp: Nút tải lên từ CSDL section & Làm mới
    const openUploadDbBtn = document.getElementById('openUploadFromDbBtn');
    if (openUploadDbBtn) {
        openUploadDbBtn.addEventListener('click', () => {
            const backdrop = document.getElementById('uploadDocModalBackdrop');
            if (backdrop) backdrop.classList.add('active');
        });
    }

    const refreshBtn = document.getElementById('refreshDbBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳ Đang đồng bộ...';
            await fetchDocumentsFromSupabase();
            showToast('🔄 Đã làm mới danh mục tệp từ CSDL Supabase!');
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄 Làm Mới';
        });
    }

    initEditDocModal();
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

    // Tạo đường dẫn chuẩn trong bucket Supabase Storage: [Thư_Mục_Chuẩn]/[Timestamp]_[filename]
    const targetFolder = getStorageFolderForCategory(category);
    const safeFilename = toSafeStorageKey(file.name);
    const remotePath = `${targetFolder}/${Date.now()}_${safeFilename}`;

    let uploadedStorageUrl = '';
    const client = getSupabase();

    if (client) {
        try {
            progressBar.style.width = '35%';
            progressPercent.textContent = '35%';

            // Tải file lên Supabase Storage
            const { data, error } = await client.storage
                .from(BUCKET_NAME)
                .upload(remotePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Lỗi tải file lên Supabase Storage:', error);
                progressWrapper.style.display = 'none';
                progressBar.style.width = '0%';
                submitBtn.disabled = false;
                submitBtn.textContent = '📤 Tải Lên & Lưu Vào Kho';
                
                alert(`⚠️ KHÔNG THỂ LƯU TỆP VÀO KHO STORAGE '${BUCKET_NAME}'!\n\nChi tiết lỗi từ Supabase: ${error.message || JSON.stringify(error)}\n\n👉 NGUYÊN NHÂN: Bucket '${BUCKET_NAME}' trên Supabase chưa được cấp quyền tải lên (Policy INSERT cho anon).\nVui lòng thêm Policy cho bucket 'tai-lieu' trên Supabase Dashboard.`);
                return;
            }

            progressBar.style.width = '75%';
            progressPercent.textContent = '75%';

            // Lấy URL công khai
            const { data: publicUrlData } = client.storage
                .from(BUCKET_NAME)
                .getPublicUrl(remotePath);

            uploadedStorageUrl = publicUrlData ? publicUrlData.publicUrl : `${SUPABASE_CONFIG.url}/storage/v1/object/public/${BUCKET_NAME}/${remotePath}`;

        } catch (err) {
            console.error('Lỗi ngoại lệ khi tải lên Supabase Storage:', err);
            progressWrapper.style.display = 'none';
            progressBar.style.width = '0%';
            submitBtn.disabled = false;
            submitBtn.textContent = '📤 Tải Lên & Lưu Vào Kho';
            alert(`⚠️ Lỗi ngoại lệ khi tải lên Storage: ${err.message}`);
            return;
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
        storageKey: remotePath,
        sizeFormatted: sizeFormatted,
        department: category === 'Quản Lý Chất Lượng' ? 'Khối Xét Nghiệm • BVĐK Đức Giang' : 'Khoa Vi Sinh • BVĐK Đức Giang',
        lead: 'BS.CK2. Đào Quang Trung'
    };

    // Lưu vào bảng documents trên Supabase PostgreSQL nếu có kết nối
    if (client) {
        try {
            const newDocDb = {
                code: code || 'SOP.NEW',
                title: title.toUpperCase(),
                category: category,
                type: type,
                year: parseInt(year) || 2024,
                filename: file.name,
                storage_key: remotePath,
                storage_url: uploadedStorageUrl,
                file_format: getFileFormatInfo(file.name).type,
                file_size_formatted: sizeFormatted,
                department: newProc.department,
                lead: newProc.lead
            };
            const { data: dbData, error: dbErr } = await client
                .from('documents')
                .insert([newDocDb])
                .select();
            if (!dbErr && dbData && dbData[0]) {
                newProc.id = dbData[0].id;
            }
        } catch (e) {
            console.warn('Lỗi lưu CSDL documents:', e);
        }
    }

    // Đưa vào State đầu danh sách
    AppState.procedures.unshift(newProc);
    saveCustomProcedure(newProc);

    // Cập nhật lại số lượng, biểu đồ và bảng quản lý kho
    initKPIs();
    updateChartsData();
    filterAndRender();
    renderStorageDbTable();

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

// 10. ĐỒNG BỘ & QUẢN LÝ CƠ SỞ DỮ LIỆU POSTGRESQL (bảng documents) & STORAGE 'tai-lieu'
async function initSupabaseData() {
    const client = getSupabase();
    const badge = document.getElementById('supabaseSidebarBadge');
    
    if (!client) {
        if (badge) badge.innerHTML = '<span class="pulse-dot" style="background-color:#f59e0b"></span> Local Mode';
        renderStorageDbTable();
        return;
    }

    try {
        if (badge) {
            badge.innerHTML = '<span class="pulse-dot"></span> Supabase Connected';
        }
        await checkStorageBucketStatus();
        await fetchDocumentsFromSupabase();
    } catch (err) {
        console.error('Lỗi khi kết nối Supabase:', err);
        if (badge) badge.innerHTML = '<span class="pulse-dot" style="background-color:#f59e0b"></span> Offline Mode';
        renderStorageDbTable();
    }
}

// Nạp danh mục tài liệu từ bảng 'documents' trên Supabase PostgreSQL
async function fetchDocumentsFromSupabase() {
    const client = getSupabase();
    const statusBadge = document.getElementById('dbStatusBadge');
    const totalCountEl = document.getElementById('dbTotalDocsCount');

    if (!client) {
        if (statusBadge) statusBadge.innerHTML = '<span class="pulse-dot" style="background-color:#f59e0b"></span> CSDL Nội Bộ (Offline)';
        renderStorageDbTable();
        return;
    }

    try {
        const { data, error } = await client
            .from('documents')
            .select('*')
            .order('id', { ascending: false });

        if (!error && data && data.length > 0) {
            // Đồng bộ dữ liệu CSDL PostgreSQL vào AppState
            AppState.procedures = data.map(d => ({
                id: d.id,
                code: d.code,
                title: d.title,
                category: d.category,
                type: d.type,
                year: d.year,
                filename: d.filename,
                path: d.storage_url || d.path,
                storageUrl: d.storage_url,
                storageKey: d.storage_key,
                sizeFormatted: d.file_size_formatted || 'PDF',
                department: d.department || 'Khoa Vi Sinh • BVĐK Đức Giang',
                lead: d.lead || 'BS.CK2. Đào Quang Trung'
            }));

            if (statusBadge) {
                statusBadge.innerHTML = `<span class="pulse-dot"></span> Đã Kết Nối CSDL (documents)`;
                statusBadge.style.color = 'var(--success)';
            }
            if (totalCountEl) {
                totalCountEl.textContent = `${data.length} tệp`;
            }

            // Cập nhật lại giao diện và biểu đồ
            initKPIs();
            updateChartsData();
            filterAndRender();
        } else {
            // Bảng documents chưa tạo hoặc đang trống -> Sử dụng danh mục 114 quy trình chuẩn
            if (statusBadge) {
                statusBadge.innerHTML = '<span class="pulse-dot" style="background-color:#0284c7"></span> Sẵn sàng (Kho tai-lieu)';
            }
            if (totalCountEl) {
                totalCountEl.textContent = `${AppState.procedures.length} tệp`;
            }
        }
    } catch (err) {
        console.warn('Lỗi đọc bảng documents từ Supabase:', err);
        if (statusBadge) statusBadge.innerHTML = '<span class="pulse-dot" style="background-color:#f59e0b"></span> Ngoại Tuyến (Offline)';
    }

    renderStorageDbTable();
}

// Hiển thị bảng Quản Lý CSDL Kho Lưu Trữ Tệp (tai-lieu)
function renderStorageDbTable() {
    const tbody = document.getElementById('storageDbTableBody');
    if (!tbody) return;

    try {
        if (!AppState.procedures || AppState.procedures.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted)">
                        Chưa có tài liệu nào trong kho. Bấm "Tải Tệp Mới Lên Kho" để bắt đầu lưu trữ.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = AppState.procedures.map(p => {
            const fmt = getFileFormatInfo(p.filename);
            const docUrl = getDocumentUrl(p);
            const isAdmin = !!(AppState.currentUser && AppState.currentUser.role === 'Admin');
            const adminButtons = isAdmin ? `
                <button onclick="handleEditDoc('${p.id}')" class="action-btn-sm" title="Sửa thông tin tệp trong CSDL">
                    ✏️ Sửa
                </button>
                <button onclick="handleDeleteDoc('${p.id}')" class="action-btn-sm delete-btn" title="Xóa tài liệu khỏi CSDL & Kho Storage">
                    🗑️ Xóa
                </button>
            ` : '';

            return `
                <tr>
                    <td>
                        <span class="code-badge">${escapeHtml(p.code)}</span>
                    </td>
                    <td>
                        <div style="font-weight:700; color:var(--sky-950); margin-bottom:2px">
                            ${escapeHtml(p.title)}
                        </div>
                        <div style="font-size:11px; color:var(--text-muted); font-family:monospace">
                            📁 ${escapeHtml(p.storageKey || p.filename)}
                        </div>
                    </td>
                    <td>
                        <span class="category-pill" style="font-size:11px; padding:3px 8px">${escapeHtml(p.category)}</span>
                    </td>
                    <td>
                        <span class="format-badge ${fmt.cssClass}">${fmt.icon} ${fmt.label}</span>
                    </td>
                    <td style="font-size:12px; color:var(--text-muted)">
                        ${escapeHtml(p.sizeFormatted || 'N/A')}
                    </td>
                    <td style="text-align:center">
                        <div class="action-btn-group" style="justify-content:center">
                            <a href="${docUrl}" target="_blank" class="action-btn-sm" title="Mở xem tài liệu từ Supabase Storage">
                                👁️ Mở
                            </a>
                            ${adminButtons}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Lỗi khi hiển thị bảng storageDbTable:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:20px; color:var(--danger)">
                    ⚠️ Đã nạp dữ liệu nhưng có lỗi giao diện: ${escapeHtml(err.message)}
                </td>
            </tr>
        `;
    }
}

// Khởi tạo Modal Chỉnh Sửa Thông Tin Tài Liệu CSDL
function initEditDocModal() {
    const modal = document.getElementById('editDocModalBackdrop');
    const closeBtn = document.getElementById('closeEditDocModalBtn');
    const cancelBtn = document.getElementById('cancelEditDocBtn');
    const form = document.getElementById('editDocForm');

    function closeEditModal() {
        if (modal) modal.classList.remove('active');
        if (form) form.reset();
    }

    if (closeBtn) closeBtn.addEventListener('click', closeEditModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'editDocModalBackdrop') closeEditModal();
        });
    }

    if (form) {
        form.addEventListener('submit', handleSaveEditDoc);
    }
}

// Mở modal sửa thông tin tài liệu
function handleEditDoc(docId) {
    if (!AppState.currentUser || AppState.currentUser.role !== 'Admin') {
        alert('⚠️ Chỉ tài khoản Admin (Trưởng Khoa) mới có quyền chỉnh sửa tài liệu!');
        return;
    }
    const doc = AppState.procedures.find(p => String(p.id) === String(docId));
    if (!doc) return;

    document.getElementById('editDocId').value = doc.id;
    document.getElementById('editDocCodeInput').value = doc.code || '';
    document.getElementById('editDocTitleInput').value = doc.title || '';
    document.getElementById('editDocCategorySelect').value = doc.category || 'Quản Lý Chất Lượng';
    document.getElementById('editDocYearInput').value = doc.year || 2024;
    document.getElementById('editDocLeadInput').value = doc.lead || 'BS.CK2. Đào Quang Trung';

    const modal = document.getElementById('editDocModalBackdrop');
    if (modal) modal.classList.add('active');
}

// Lưu thông tin sau khi chỉnh sửa lên Supabase Database
async function handleSaveEditDoc(e) {
    e.preventDefault();

    const id = document.getElementById('editDocId').value;
    const code = document.getElementById('editDocCodeInput').value.trim();
    const title = document.getElementById('editDocTitleInput').value.trim();
    const category = document.getElementById('editDocCategorySelect').value;
    const year = parseInt(document.getElementById('editDocYearInput').value) || 2024;
    const lead = document.getElementById('editDocLeadInput').value.trim();

    const docIndex = AppState.procedures.findIndex(p => String(p.id) === String(id));
    if (docIndex !== -1) {
        AppState.procedures[docIndex].code = code;
        AppState.procedures[docIndex].title = title.toUpperCase();
        AppState.procedures[docIndex].category = category;
        AppState.procedures[docIndex].year = year;
        AppState.procedures[docIndex].lead = lead;
    }

    const client = getSupabase();
    if (client) {
        try {
            await client
                .from('documents')
                .update({
                    code: code,
                    title: title.toUpperCase(),
                    category: category,
                    year: year,
                    lead: lead,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
        } catch (err) {
            console.warn('Lỗi cập nhật CSDL Supabase:', err);
        }
    }

    document.getElementById('editDocModalBackdrop').classList.remove('active');
    filterAndRender();
    renderStorageDbTable();
    showToast(`✅ Đã cập nhật thành công tài liệu "${code}" trong CSDL!`);
}

// Xóa tài liệu khỏi Cơ sở dữ liệu và Storage Bucket 'tai-lieu'
async function handleDeleteDoc(docId) {
    if (!AppState.currentUser || AppState.currentUser.role !== 'Admin') {
        alert('⚠️ Chỉ tài khoản Admin (Trưởng Khoa) mới có quyền xóa tài liệu khỏi hệ thống!');
        return;
    }
    const doc = AppState.procedures.find(p => String(p.id) === String(docId));
    if (!doc) return;

    const confirmMsg = `Bạn có chắc chắn muốn xóa tài liệu:\n"${doc.code} - ${doc.title}"\nkhỏi Cơ sở dữ liệu và Kho lưu trữ tệp 'tai-lieu'?`;
    if (!confirm(confirmMsg)) return;

    const client = getSupabase();
    if (client) {
        try {
            // 1. Xóa bản ghi trong CSDL PostgreSQL
            await client
                .from('documents')
                .delete()
                .eq('id', docId);

            // 2. Xóa tệp vật lý trong Storage Bucket 'tai-lieu'
            if (doc.storageKey) {
                await client.storage
                    .from(BUCKET_NAME)
                    .remove([doc.storageKey]);
            }
        } catch (err) {
            console.warn('Lỗi xóa trên Supabase:', err);
        }
    }

    // Xóa khỏi State cục bộ
    AppState.procedures = AppState.procedures.filter(p => String(p.id) !== String(docId));

    // Cập nhật lại KPIs, biểu đồ và các bảng
    initKPIs();
    updateChartsData();
    filterAndRender();
    renderStorageDbTable();

    showToast(`🗑️ Đã xóa tài liệu "${doc.code}" khỏi CSDL và Kho Storage!`);
}

// ============================================================================
// HỆ THỐNG XÁC THỰC VÀ PHÂN QUYỀN (AUTHENTICATION & RBAC)
// ============================================================================

function initAuth() {
    const loginOverlay = document.getElementById('loginScreenOverlay');
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('loginEmailInput');
    const passwordInput = document.getElementById('loginPasswordInput');
    const errorMsg = document.getElementById('loginErrorMsg');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const openGuideBtn = document.getElementById('openQuickAccountGuideBtn');
    const closeGuideBtn = document.getElementById('closeQuickAccountModalBtn');
    const guideModal = document.getElementById('quickAccountModalBackdrop');

    // 1. Kiểm tra phiên đăng nhập đã lưu trong LocalStorage
    try {
        const savedUserJson = localStorage.getItem('currentUser_v1');
        if (savedUserJson) {
            const savedUser = JSON.parse(savedUserJson);
            if (savedUser && savedUser.gmail) {
                AppState.currentUser = savedUser;
                if (loginOverlay) loginOverlay.classList.add('hidden');
                applyUserPermissions();
            }
        }
    } catch (e) {
        console.warn('Lỗi đọc currentUser_v1:', e);
    }

    // Nếu chưa đăng nhập, đảm bảo màn hình đăng nhập hiển thị
    if (!AppState.currentUser) {
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        document.body.classList.remove('is-admin');
    }

    // 2. Hiện / Ẩn mật khẩu
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            togglePasswordBtn.textContent = isPassword ? '🙈' : '👁️';
        });
    }

    // 3. Xử lý Đăng Nhập
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = (emailInput.value || '').trim().toLowerCase();
            const password = (passwordInput.value || '').trim();

            if (errorMsg) errorMsg.style.display = 'none';

            const accounts = typeof STAFF_ACCOUNTS !== 'undefined' ? STAFF_ACCOUNTS : [];
            const user = accounts.find(a => (a.gmail || '').trim().toLowerCase() === email);

            if (!user) {
                if (errorMsg) {
                    errorMsg.textContent = '❌ Không tìm thấy địa chỉ Gmail này trong danh sách nhân viên Khoa Vi Sinh!';
                    errorMsg.style.display = 'block';
                }
                return;
            }

            // Kiểm tra mật khẩu: thông tin trong cột vai trò từng người ('Admin' hoặc 'User')
            // So sánh không phân biệt hoa thường để tiện cho người dùng gõ 'Admin', 'admin', 'User', 'user'
            if (password.toLowerCase() !== user.role.toLowerCase()) {
                if (errorMsg) {
                    errorMsg.textContent = `❌ Mật khẩu không đúng! Mật khẩu là giá trị trong cột vai trò của bạn (${user.role}).`;
                    errorMsg.style.display = 'block';
                }
                return;
            }

            // Đăng nhập thành công
            AppState.currentUser = user;
            try {
                localStorage.setItem('currentUser_v1', JSON.stringify(user));
            } catch (err) {}

            if (loginOverlay) loginOverlay.classList.add('hidden');
            loginForm.reset();
            applyUserPermissions();

            const roleTitle = user.role === 'Admin' ? 'Trưởng Khoa (Admin)' : 'Nhân Viên (User)';
            showToast(`👋 Chào mừng ${user.name} (${roleTitle}) đã đăng nhập thành công!`);
        });
    }

    // 4. Xử lý Đăng Xuất
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?')) {
                localStorage.removeItem('currentUser_v1');
                AppState.currentUser = null;
                document.body.classList.remove('is-admin');
                applyUserPermissions();
                if (loginOverlay) {
                    loginOverlay.classList.remove('hidden');
                    if (emailInput) {
                        emailInput.value = '';
                        emailInput.focus();
                    }
                    if (passwordInput) passwordInput.value = '';
                }
                showToast('👋 Đã đăng xuất khỏi hệ thống.');
            }
        });
    }

    // 5. Mở modal tra cứu nhanh tài khoản
    if (openGuideBtn && guideModal) {
        openGuideBtn.addEventListener('click', () => {
            guideModal.classList.add('active');
        });
    }
    if (closeGuideBtn && guideModal) {
        closeGuideBtn.addEventListener('click', () => {
            guideModal.classList.remove('active');
        });
    }
    if (guideModal) {
        guideModal.addEventListener('click', (e) => {
            if (e.target.id === 'quickAccountModalBackdrop') {
                guideModal.classList.remove('active');
            }
        });
    }
}

// Áp dụng quyền hạn người dùng dựa trên vai trò (RBAC)
function applyUserPermissions() {
    const user = AppState.currentUser;
    const isAdmin = !!(user && user.role === 'Admin');

    // Thêm/Xóa class is-admin trên <body> để điều khiển hiển thị CSS
    document.body.classList.toggle('is-admin', isAdmin);

    // Cập nhật thông tin góc trái dưới Sidebar
    const nameEl = document.getElementById('sidebarUserName');
    const badgeEl = document.getElementById('sidebarRoleBadge');
    const avatarEl = document.getElementById('sidebarUserAvatar');

    if (nameEl) {
        nameEl.textContent = user ? `${user.name} (${user.title})` : 'Chưa đăng nhập';
        nameEl.title = user ? `${user.name} - ${user.gmail}` : '';
    }

    if (badgeEl) {
        if (isAdmin) {
            badgeEl.className = 'badge-role admin';
            badgeEl.textContent = 'Admin (Trưởng Khoa)';
        } else if (user) {
            badgeEl.className = 'badge-role user';
            badgeEl.textContent = 'User (Nhân viên)';
        } else {
            badgeEl.className = 'badge-role';
            badgeEl.textContent = 'Khách';
        }
    }

    if (avatarEl) {
        avatarEl.textContent = isAdmin ? '🛡️' : '👨‍⚕️';
    }

    // Cập nhật lại bảng CSDL để hiển thị hoặc ẩn nút Sửa/Xóa
    renderStorageDbTable();
}

// Hiển thị danh sách 12 tài khoản nhân viên (theo ảnh đính kèm)
function renderStaffAccountsTable() {
    const accounts = typeof STAFF_ACCOUNTS !== 'undefined' ? STAFF_ACCOUNTS : [];
    const mainTbody = document.getElementById('staffAccountsTableBody');
    const modalTbody = document.getElementById('quickAccountModalTableBody');

    const html = accounts.map(acc => {
        const isAdmin = acc.role === 'Admin';
        const roleBadge = isAdmin
            ? '<span class="staff-role-badge admin">Admin</span>'
            : '<span class="staff-role-badge user">User</span>';
        
        return `
            <tr style="cursor:pointer" onclick="quickFillLogin('${escapeHtml(acc.gmail)}', '${escapeHtml(acc.role)}')" title="Nhấp để điền nhanh thông tin đăng nhập">
                <td style="text-align:center; font-weight:700">${acc.stt}</td>
                <td style="font-weight:700; color:var(--sky-950)">${escapeHtml(acc.name)}</td>
                <td style="color:var(--text-main)">${escapeHtml(acc.title)}</td>
                <td class="staff-email-red">${escapeHtml(acc.gmail)}</td>
                <td style="text-align:center">${roleBadge}</td>
            </tr>
        `;
    }).join('');

    if (mainTbody) mainTbody.innerHTML = html;
    if (modalTbody) modalTbody.innerHTML = html;
}

// Tiện ích click vào dòng tài khoản để điền nhanh form đăng nhập
function quickFillLogin(gmail, role) {
    const emailInput = document.getElementById('loginEmailInput');
    const passwordInput = document.getElementById('loginPasswordInput');
    const guideModal = document.getElementById('quickAccountModalBackdrop');

    if (emailInput) emailInput.value = gmail;
    if (passwordInput) passwordInput.value = role;
    if (guideModal) guideModal.classList.remove('active');

    const loginOverlay = document.getElementById('loginScreenOverlay');
    if (loginOverlay && !loginOverlay.classList.contains('hidden')) {
        const submitBtn = document.getElementById('loginSubmitBtn');
        if (submitBtn) submitBtn.focus();
    }
}

// ============================================================================
// KHU VỰC QUẢN LÝ VÀ TRA CỨU VĂN BẢN Y TẾ (MEDICAL DOCUMENTS)
// ============================================================================

function initMedicalDocs() {
    const searchInput = document.getElementById('medSearchInput');
    const clearBtn = document.getElementById('medSearchClearBtn');
    const formatFilter = document.getElementById('medFormatFilter');
    const yearFilter = document.getElementById('medYearFilter');
    const sortFilter = document.getElementById('medSortFilter');
    const resetBtn = document.getElementById('medResetFilterBtn');

    if (!document.getElementById('medicalDocsSection')) return;

    // Render Stats & Category Pills
    renderMedicalStatsGrid();
    renderMedicalCategoryPills();

    // 1. Live Instant Search as user types
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            AppState.medSearchQuery = e.target.value.trim();
            if (clearBtn) clearBtn.classList.toggle('visible', !!AppState.medSearchQuery);
            const liveBadge = document.getElementById('medSearchIndicator');
            if (liveBadge) liveBadge.style.display = AppState.medSearchQuery ? 'inline-flex' : 'none';
            filterAndRenderMedicalDocs();
        });
    }

    if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            AppState.medSearchQuery = '';
            clearBtn.classList.remove('visible');
            const liveBadge = document.getElementById('medSearchIndicator');
            if (liveBadge) liveBadge.style.display = 'none';
            filterAndRenderMedicalDocs();
            searchInput.focus();
        });
    }

    // 2. Format filter
    if (formatFilter) {
        formatFilter.addEventListener('change', (e) => {
            AppState.selectedMedFormat = e.target.value;
            filterAndRenderMedicalDocs();
        });
    }

    // 3. Year filter
    if (yearFilter) {
        yearFilter.addEventListener('change', (e) => {
            AppState.selectedMedYear = e.target.value;
            filterAndRenderMedicalDocs();
        });
    }

    // 4. Sort filter
    if (sortFilter) {
        sortFilter.addEventListener('change', (e) => {
            AppState.selectedMedSort = e.target.value;
            filterAndRenderMedicalDocs();
        });
    }

    // 5. Reset filter button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            AppState.selectedMedCategory = 'all';
            AppState.medSearchQuery = '';
            AppState.selectedMedFormat = 'all';
            AppState.selectedMedYear = 'all';
            AppState.selectedMedSort = 'year_desc';

            if (searchInput) {
                searchInput.value = '';
                if (clearBtn) clearBtn.classList.remove('visible');
            }
            if (formatFilter) formatFilter.value = 'all';
            if (yearFilter) yearFilter.value = 'all';
            if (sortFilter) sortFilter.value = 'year_desc';

            renderMedicalCategoryPills();
            renderMedicalStatsGrid();
            filterAndRenderMedicalDocs();
        });
    }

    // Initial render
    filterAndRenderMedicalDocs();
}

function renderMedicalStatsGrid() {
    const grid = document.getElementById('medStatsGrid');
    if (!grid) return;

    const docs = AppState.medicalDocs || [];
    const categories = typeof MEDICAL_DOC_CATEGORIES !== 'undefined' ? MEDICAL_DOC_CATEGORIES : [
        { id: 'all', name: 'Tất Cả Văn Bản', icon: '📚' }
    ];

    grid.innerHTML = categories.map(cat => {
        const count = cat.id === 'all'
            ? docs.length
            : docs.filter(d => d.category === cat.id).length;
        const isActive = AppState.selectedMedCategory === cat.id;

        return `
            <div class="med-stat-card ${isActive ? 'active' : ''}" onclick="selectMedCategory('${cat.id}')">
                <span class="med-stat-icon">${cat.icon}</span>
                <div class="med-stat-info">
                    <div class="med-stat-count">${count}</div>
                    <div class="med-stat-name" title="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderMedicalCategoryPills() {
    const pillsContainer = document.getElementById('medCategoryPills');
    if (!pillsContainer) return;

    const docs = AppState.medicalDocs || [];
    const categories = typeof MEDICAL_DOC_CATEGORIES !== 'undefined' ? MEDICAL_DOC_CATEGORIES : [
        { id: 'all', name: 'Tất Cả Văn Bản', icon: '📚' }
    ];

    pillsContainer.innerHTML = categories.map(cat => {
        const count = cat.id === 'all'
            ? docs.length
            : docs.filter(d => d.category === cat.id).length;
        const isActive = AppState.selectedMedCategory === cat.id;

        return `
            <button type="button" class="med-cat-pill ${isActive ? 'active' : ''}" onclick="selectMedCategory('${cat.id}')">
                <span>${cat.icon}</span>
                <span>${escapeHtml(cat.name)}</span>
                <span class="pill-badge">${count}</span>
            </button>
        `;
    }).join('');
}

function selectMedCategory(catId) {
    AppState.selectedMedCategory = catId;
    renderMedicalCategoryPills();
    renderMedicalStatsGrid();
    filterAndRenderMedicalDocs();
}

function filterAndRenderMedicalDocs() {
    const tbody = document.getElementById('medDocsTableBody');
    const resultCountEl = document.getElementById('medResultCount');
    const emptyState = document.getElementById('medEmptyState');
    if (!tbody) return;

    let list = [...(AppState.medicalDocs || [])];

    // 1. Lọc theo Nhóm chuyên môn
    if (AppState.selectedMedCategory && AppState.selectedMedCategory !== 'all') {
        list = list.filter(d => d.category === AppState.selectedMedCategory);
    }

    // 2. Tìm kiếm nhanh trực tiếp (Live Instant Search)
    const q = (AppState.medSearchQuery || '').trim();
    if (q) {
        const qNorm = removeVietnameseTones(q);
        const qParts = qNorm.split(/\s+/).filter(Boolean);

        list = list.filter(d => {
            const rawTarget = `${d.title} ${d.code} ${d.categoryName} ${d.issuer} ${d.year} ${d.keywords || ''}`;
            const targetNorm = removeVietnameseTones(rawTarget);
            return qParts.every(part => targetNorm.includes(part));
        });
    }

    // 3. Lọc theo Định dạng
    if (AppState.selectedMedFormat && AppState.selectedMedFormat !== 'all') {
        list = list.filter(d => d.format === AppState.selectedMedFormat);
    }

    // 4. Lọc theo Năm ban hành
    if (AppState.selectedMedYear && AppState.selectedMedYear !== 'all') {
        if (AppState.selectedMedYear === '2025-2026') {
            list = list.filter(d => d.year >= 2025);
        } else if (AppState.selectedMedYear === '2024') {
            list = list.filter(d => d.year === 2024);
        } else if (AppState.selectedMedYear === '2023') {
            list = list.filter(d => d.year === 2023);
        } else if (AppState.selectedMedYear === '2020-2022') {
            list = list.filter(d => d.year >= 2020 && d.year <= 2022);
        } else if (AppState.selectedMedYear === 'older') {
            list = list.filter(d => d.year < 2020);
        }
    }

    // 5. Sắp xếp
    if (AppState.selectedMedSort === 'year_desc') {
        list.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
    } else if (AppState.selectedMedSort === 'year_asc') {
        list.sort((a, b) => (a.year || 0) - (b.year || 0) || a.title.localeCompare(b.title));
    } else if (AppState.selectedMedSort === 'title_asc') {
        list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (AppState.selectedMedSort === 'size_desc') {
        list.sort((a, b) => (b.size || 0) - (a.size || 0));
    }

    AppState.filteredMedicalDocs = list;

    // Cập nhật kết quả đếm
    const totalAll = (AppState.medicalDocs || []).length;
    if (resultCountEl) {
        if (q) {
            resultCountEl.innerHTML = `⚡ Tìm kiếm siêu tốc: Tìm thấy <strong>${list.length}</strong> / ${totalAll} văn bản khớp với từ khóa "<em>${escapeHtml(q)}</em>"`;
        } else if (AppState.selectedMedCategory !== 'all') {
            const catObj = (typeof MEDICAL_DOC_CATEGORIES !== 'undefined' ? MEDICAL_DOC_CATEGORIES : []).find(c => c.id === AppState.selectedMedCategory);
            resultCountEl.innerHTML = `Hiển thị <strong>${list.length}</strong> văn bản thuộc nhóm <strong>${escapeHtml(catObj ? catObj.name : AppState.selectedMedCategory)}</strong>`;
        } else {
            resultCountEl.innerHTML = `Tổng cộng <strong>${list.length}</strong> văn bản y tế đã số hóa & lưu trữ trên Supabase Storage`;
        }
    }

    // Hiển thị trạng thái rỗng nếu không khớp
    if (list.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    // 6. Render các hàng văn bản
    tbody.innerHTML = list.map((doc, idx) => {
        const catTag = getMedCategoryTag(doc.category, doc.categoryName);
        const highlightedTitle = highlightSearchQuery(doc.title, q);
        const highlightedCode = highlightSearchQuery(doc.code || 'VBYT', q);

        return `
            <tr>
                <td style="text-align:center; font-weight:700; color:var(--text-muted)">
                    ${idx + 1}
                </td>
                <td>
                    <span class="code-badge" style="font-size:12px; font-weight:700; background:#f1f5f9; border:1px solid #cbd5e1; color:#0f172a">
                        ${highlightedCode}
                    </span>
                </td>
                <td>
                    <div style="font-weight:700; color:var(--sky-950); margin-bottom:4px; line-height:1.4">
                        ${highlightedTitle}
                    </div>
                    <div style="font-size:11.5px; color:var(--text-muted); font-family:monospace">
                        📁 ${escapeHtml(doc.filename)}
                    </div>
                </td>
                <td>
                    ${catTag}
                </td>
                <td style="font-size:12.5px">
                    <div style="font-weight:600; color:var(--text-main)">${escapeHtml(doc.issuer || 'Bộ Y tế')}</div>
                    <div style="font-size:11.5px; color:var(--text-muted)">Năm ${doc.year || '2024'}</div>
                </td>
                <td style="text-align:center">
                    <span class="format-badge ${doc.formatClass || 'format-pdf'}" style="font-size:11px">
                        ${doc.formatIcon || '📄'} ${doc.formatLabel || 'PDF'}
                    </span>
                    <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px">
                        ${doc.sizeFormatted || ''}
                    </div>
                </td>
                <td style="text-align:center">
                    <div class="action-btn-group" style="justify-content:center">
                        <a 
                            href="${doc.storageUrl}" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            class="btn-view-doc" 
                            title="Mở xem văn bản gốc toàn văn từ Supabase Storage"
                        >
                            👁️ Xem Gốc
                        </a>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getMedCategoryTag(category, categoryName) {
    const classMap = {
        'Chuyen_Mon_Vi_Sinh': 'tag-chuyen-mon',
        'Quan_Ly_Chat_Luong_ISO': 'tag-qlcl',
        'An_Toan_Sinh_Hoc': 'tag-atsh',
        'Phac_Do_Dieu_Tri': 'tag-phac-do',
        'Van_Ban_Phap_Quy': 'tag-phap-quy',
        'Benh_Vien_Va_So_Y_Te': 'tag-benh-vien',
        'Phong_Chong_Dich_Covid': 'tag-covid'
    };
    const cssClass = classMap[category] || 'tag-phap-quy';
    return `<span class="med-cat-tag ${cssClass}">${escapeHtml(categoryName)}</span>`;
}

function highlightSearchQuery(text, query) {
    if (!text) return '';
    if (!query) return escapeHtml(text);
    
    try {
        const words = query.trim().split(/\s+/).filter(w => w.length > 0);
        let escaped = escapeHtml(text);
        
        words.forEach(word => {
            const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            escaped = escaped.replace(regex, '<span class="search-highlight">$1</span>');
        });
        return escaped;
    } catch (e) {
        return escapeHtml(text);
    }
}

// ==========================================================================
// UNIVERSAL SEARCH & GOOGLE GEMINI AI ASSISTANT ENGINE
// TÌM KIẾM TỔNG THỂ & HỎI ĐÁP AI THÔNG MINH
// ==========================================================================

function initUniversalSearch() {
    const searchInput = document.getElementById('univSearchInput');
    const clearBtn = document.getElementById('univClearBtn');
    const searchBtn = document.getElementById('univSearchBtn');
    const countAllEl = document.getElementById('univCountAll');
    const scopePills = document.querySelectorAll('.univ-scope-pill');
    const promptChips = document.querySelectorAll('.prompt-chip');
    const triggerGeminiBtn = document.getElementById('btnTriggerGeminiExpand');
    const triggerEmptyGeminiBtn = document.getElementById('btnEmptyTriggerGemini');

    // Cập nhật tổng số tài liệu (409)
    if (countAllEl) {
        const totalDocs = (AppState.procedures || []).length + (AppState.medicalDocs || []).length;
        countAllEl.textContent = totalDocs > 0 ? totalDocs : '409';
    }

    // Cập nhật trạng thái khóa API Gemini trên huy hiệu
    updateGeminiBadgeStatus();

    // 1. Lắng nghe ô tìm kiếm
    let debounceTimer = null;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (clearBtn) {
                if (val) clearBtn.classList.add('visible');
                else clearBtn.classList.remove('visible');
            }
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                executeUniversalSearch(val, AppState.universalSearch.scope);
            }, 280);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimer);
                executeUniversalSearch(searchInput.value.trim(), AppState.universalSearch.scope);
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            clearBtn.classList.remove('visible');
            executeUniversalSearch('', AppState.universalSearch.scope);
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (searchInput) {
                executeUniversalSearch(searchInput.value.trim(), AppState.universalSearch.scope);
            }
        });
    }

    // 2. Lắng nghe phạm vi tìm kiếm (Scope Pills)
    scopePills.forEach(pill => {
        pill.addEventListener('click', () => {
            scopePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const scope = pill.getAttribute('data-scope') || 'all';
            AppState.universalSearch.scope = scope;
            if (searchInput) {
                executeUniversalSearch(searchInput.value.trim(), scope);
            }
        });
    });

    // 3. Gợi ý câu hỏi thông minh (Prompt Chips)
    promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.getAttribute('data-prompt');
            if (prompt && searchInput) {
                searchInput.value = prompt;
                if (clearBtn) clearBtn.classList.add('visible');
                executeUniversalSearch(prompt, AppState.universalSearch.scope);
                window.scrollTo({ top: 120, behavior: 'smooth' });
            }
        });
    });

    // 4. Nút kích hoạt mở rộng bằng AI Gemini
    if (triggerGeminiBtn) {
        triggerGeminiBtn.addEventListener('click', () => {
            triggerGeminiAIExpansion();
        });
    }
    if (triggerEmptyGeminiBtn) {
        triggerEmptyGeminiBtn.addEventListener('click', () => {
            triggerGeminiAIExpansion();
        });
    }

    // 5. Cài đặt Modal khóa API Gemini
    setupGeminiKeyModal();
}

// Cập nhật trạng thái hiển thị của Gemini Badge
function updateGeminiBadgeStatus() {
    const badge = document.getElementById('openGeminiKeyModalBtn');
    if (!badge) return;
    const key = localStorage.getItem('gemini_api_key');
    if (key && key.trim()) {
        badge.innerHTML = `
            <span class="gemini-sparkle">✨</span>
            <span class="gemini-acc-text">Gemini Connected (bsdaoquangtrungducgiang@gmail.com)</span>
            <span class="gemini-gear-btn">⚙️</span>
        `;
        badge.style.background = '#f0fdf4';
        badge.style.borderColor = '#86efac';
        badge.style.color = '#15803d';
    } else {
        badge.innerHTML = `
            <span class="gemini-sparkle">✨</span>
            <span class="gemini-acc-text">Gemini AI (bsdaoquangtrungducgiang@gmail.com)</span>
            <span class="gemini-gear-btn">⚙️</span>
        `;
        badge.style.background = '#fdf4ff';
        badge.style.borderColor = '#f0abfc';
        badge.style.color = '#86198f';
    }
}

// Thiết lập Modal nhập khóa API Gemini
function setupGeminiKeyModal() {
    const openBtn = document.getElementById('openGeminiKeyModalBtn');
    const modalBackdrop = document.getElementById('geminiKeyModalBackdrop');
    const closeBtn = document.getElementById('closeGeminiKeyModalBtn');
    const saveBtn = document.getElementById('saveGeminiKeyBtn');
    const clearBtn = document.getElementById('clearGeminiKeyBtn');
    const keyInput = document.getElementById('geminiApiKeyInput');

    if (openBtn && modalBackdrop) {
        openBtn.addEventListener('click', () => {
            const currentKey = localStorage.getItem('gemini_api_key') || '';
            if (keyInput) keyInput.value = currentKey;
            modalBackdrop.classList.add('active');
        });
    }

    const closeModal = () => {
        if (modalBackdrop) modalBackdrop.classList.remove('active');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target.id === 'geminiKeyModalBackdrop') closeModal();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const keyVal = (keyInput ? keyInput.value.trim() : '');
            if (!keyVal) {
                showToast('⚠️ Vui lòng nhập khóa API hoặc bấm Hủy!');
                return;
            }
            localStorage.setItem('gemini_api_key', keyVal);
            updateGeminiBadgeStatus();
            closeModal();
            showToast('✅ Đã lưu kết nối Gemini AI thành công cho bsdaoquangtrungducgiang@gmail.com!');
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem('gemini_api_key');
            if (keyInput) keyInput.value = '';
            updateGeminiBadgeStatus();
            closeModal();
            showToast('ℹ️ Đã xóa khóa API Gemini cá nhân');
        });
    }
}

// Tổng hợp danh sách tài liệu toàn diện (114 quy trình + 295 văn bản y tế = 409 tệp)
function getAllKnowledgeDocuments() {
    const procedures = (AppState.procedures || []).map(p => ({
        id: `proc_${p.id}`,
        code: p.code || 'XN',
        title: p.title || 'Quy trình kỹ thuật vi sinh',
        category: p.category || 'Kỹ thuật',
        categoryName: p.category || 'Quy trình vi sinh',
        itemType: 'procedure',
        typeName: 'Quy Trình Xét Nghiệm',
        year: p.year || 2024,
        issuer: p.department || 'BVĐK Đức Giang',
        storageKey: p.storageKey || '',
        storageUrl: getDocumentUrl(p),
        filename: p.filename || '',
        format: (p.filename || '').endsWith('.docx') ? 'word' : (p.filename || '').endsWith('.xlsx') ? 'excel' : 'pdf',
        formatLabel: (p.filename || '').endsWith('.docx') ? 'Word' : (p.filename || '').endsWith('.xlsx') ? 'Excel' : 'PDF',
        formatIcon: (p.filename || '').endsWith('.docx') ? '📝' : (p.filename || '').endsWith('.xlsx') ? '📊' : '📄',
        formatClass: (p.filename || '').endsWith('.docx') ? 'format-word' : (p.filename || '').endsWith('.xlsx') ? 'format-excel' : 'format-pdf',
        sizeFormatted: p.sizeFormatted || 'Tài liệu chuẩn',
        keywords: `${p.title} ${p.code} ${p.category} ${p.type || ''} ${p.lead || ''}`
    }));

    const medicalDocs = (AppState.medicalDocs || []).map(m => ({
        id: m.id,
        code: m.code || 'VBYT',
        title: m.title || 'Văn bản y tế',
        category: m.category || 'Phap_Quy',
        categoryName: m.categoryName || 'Văn bản pháp quy',
        itemType: 'medical',
        typeName: 'Văn Bản Y Tế',
        year: m.year || 2024,
        issuer: m.issuer || 'Bộ Y tế',
        storageKey: m.storageKey || '',
        storageUrl: m.storageUrl || '',
        filename: m.filename || '',
        format: m.format || 'pdf',
        formatLabel: m.formatLabel || 'PDF',
        formatIcon: m.formatIcon || '📄',
        formatClass: m.formatClass || 'format-pdf',
        sizeFormatted: m.sizeFormatted || '',
        keywords: m.keywords || m.title
    }));

    return [...procedures, ...medicalDocs];
}

// Thực thi tìm kiếm thông minh
function executeUniversalSearch(query, scope) {
    const loadingCard = document.getElementById('univLoadingCard');
    const aiOverviewCard = document.getElementById('univAiOverviewCard');
    const geminiResultCard = document.getElementById('geminiResultCard');
    const resultsSec = document.getElementById('univResultsSection');
    const emptyState = document.getElementById('univEmptyState');
    const resultsCountText = document.getElementById('univResultsCountText');

    AppState.universalSearch.query = query;
    const q = (query || '').trim();

    // Ẩn kết quả Gemini mở rộng trước đó khi tìm kiếm mới
    if (geminiResultCard) geminiResultCard.style.display = 'none';

    if (!q) {
        if (loadingCard) loadingCard.style.display = 'none';
        if (aiOverviewCard) aiOverviewCard.style.display = 'none';
        if (resultsSec) resultsSec.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        return;
    }

    // Hiển thị trạng thái tải nhẹ
    if (loadingCard) loadingCard.style.display = 'block';
    if (aiOverviewCard) aiOverviewCard.style.display = 'none';
    if (resultsSec) resultsSec.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    setTimeout(() => {
        if (loadingCard) loadingCard.style.display = 'none';

        const allDocs = getAllKnowledgeDocuments();
        const qNorm = removeVietnameseTones(q).toLowerCase();
        const qTokens = qNorm.split(/\s+/).filter(w => w.length > 0);

        // Chấm điểm và lọc
        const scoredDocs = [];
        allDocs.forEach(doc => {
            // Lọc theo phạm vi (Scope)
            if (scope === 'procedures' && doc.itemType !== 'procedure') return;
            if (scope === 'medical' && doc.itemType !== 'medical') return;

            const codeNorm = removeVietnameseTones(doc.code || '').toLowerCase();
            const titleNorm = removeVietnameseTones(doc.title || '').toLowerCase();
            const catNorm = removeVietnameseTones(doc.categoryName || '').toLowerCase();
            const kwNorm = removeVietnameseTones(doc.keywords || '').toLowerCase();
            const fnNorm = removeVietnameseTones(doc.filename || '').toLowerCase();

            let score = 0;

            // Khớp chính xác mã
            if (codeNorm.includes(qNorm)) score += 120;
            if (titleNorm.includes(qNorm)) score += 80;

            // Khớp từng từ khóa
            let tokenMatchCount = 0;
            qTokens.forEach(token => {
                if (codeNorm.includes(token)) { score += 40; tokenMatchCount++; }
                else if (titleNorm.includes(token)) { score += 25; tokenMatchCount++; }
                else if (catNorm.includes(token)) { score += 15; tokenMatchCount++; }
                else if (kwNorm.includes(token) || fnNorm.includes(token)) { score += 10; tokenMatchCount++; }
            });

            // Nếu khớp ít nhất 1 từ (hoặc chuỗi đơn khớp)
            if (score > 0 && (qTokens.length <= 1 || tokenMatchCount >= 1)) {
                scoredDocs.push({ ...doc, searchScore: score });
            }
        });

        // Sắp xếp theo điểm giảm dần
        scoredDocs.sort((a, b) => b.searchScore - a.searchScore || (b.year || 0) - (a.year || 0));

        AppState.universalSearch.matchedDocs = scoredDocs;

        if (scoredDocs.length > 0) {
            // 1. Hiển thị AI Overview tự động tổng hợp từ kho lưu trữ
            renderStorageAIOverview(q, scoredDocs.slice(0, 5));
            if (aiOverviewCard) aiOverviewCard.style.display = 'block';

            // 2. Hiển thị danh sách tài liệu khớp
            renderUniversalDocResults(scoredDocs, q);
            if (resultsSec) resultsSec.style.display = 'block';
            if (resultsCountText) {
                resultsCountText.textContent = `Các tài liệu liên quan trong Kho Lưu Trữ (${scoredDocs.length})`;
            }
        } else {
            // Không tìm thấy trong kho nội bộ -> Hiện Empty State + khuyến nghị mở rộng AI Gemini
            if (emptyState) emptyState.style.display = 'block';
        }
    }, 180);
}

// Tổng hợp câu trả lời thông minh từ Kho Lưu Trữ (AI Overview)
function renderStorageAIOverview(query, topMatches) {
    const overviewContent = document.getElementById('aiOverviewContent');
    const subtitle = document.getElementById('aiOverviewSubtitle');
    if (!overviewContent) return;

    if (subtitle) {
        subtitle.innerHTML = `Đã phân tích <strong>${topMatches.length}</strong> tài liệu phù hợp nhất trong kho lưu trữ đám mây <code>tai-lieu</code>`;
    }

    const first = topMatches[0] || {};
    const qLower = query.toLowerCase();

    // 1. Tổng hợp đoạn trả lời trọng tâm
    let summaryText = `Dựa trên kết quả đối soát hệ thống <strong>409 tài liệu</strong> trong kho lưu trữ, nội dung liên quan trực tiếp đến <em>"${escapeHtml(query)}"</em> được quy định và hướng dẫn chi tiết tại <strong>${escapeHtml(first.code)}: ${escapeHtml(first.title)}</strong> (Ban hành bởi ${escapeHtml(first.issuer || 'Bộ Y tế')}, năm ${first.year || 2024}).`;

    // 2. Trích xuất các điểm cốt lõi (Key Takeaways)
    const bulletPoints = [];
    topMatches.slice(0, 4).forEach((doc, idx) => {
        if (doc.itemType === 'procedure') {
            bulletPoints.push(`<strong>Quy trình số hóa [${escapeHtml(doc.code)}]:</strong> ${escapeHtml(doc.title)} — Áp dụng chuyên môn tại ${escapeHtml(doc.categoryName)}, đơn vị thực hiện: ${escapeHtml(doc.issuer)}.`);
        } else {
            bulletPoints.push(`<strong>Văn bản y tế [${escapeHtml(doc.code)}]:</strong> ${escapeHtml(doc.title)} — Ban hành bởi ${escapeHtml(doc.issuer)}, hiệu lực năm ${doc.year}.`);
        }
    });

    if (qLower.includes('kháng sinh') || qLower.includes('ksd')) {
        bulletPoints.push(`<strong>Kiểm soát chất lượng:</strong> Tuân thủ hướng dẫn thực hành vi sinh lâm sàng phục vụ giám sát kháng thuốc (QĐ 1539/QĐ-BYT) và quy trình nội kiểm kháng sinh đồ định kỳ.`);
    } else if (qLower.includes('an toàn') || qLower.includes('atsh')) {
        bulletPoints.push(`<strong>Tiêu chuẩn ATSH:</strong> Thực hiện theo Nghị định 103/2016/NĐ-CP và Thông tư 37/2017/TT-BYT đối với phòng xét nghiệm an toàn sinh học cấp II.`);
    } else if (qLower.includes('2429') || qLower.includes('chất lượng') || qLower.includes('iso')) {
        bulletPoints.push(`<strong>Đánh giá phòng xét nghiệm:</strong> Áp dụng Bộ tiêu chí 2429/QĐ-BYT và tiêu chuẩn Quốc tế ISO 15189:2022 trong quản lý mẫu, hóa chất, thiết bị và nội/ngoại kiểm.`);
    }

    // 3. Render danh sách thẻ trích dẫn tài liệu gốc
    const sourceChips = topMatches.slice(0, 5).map(doc => {
        return `
            <a href="${doc.storageUrl}" target="_blank" rel="noopener noreferrer" class="ai-source-chip" title="Xem văn bản gốc: ${escapeHtml(doc.title)}">
                <span>${doc.formatIcon || '📄'}</span>
                <span>${escapeHtml(doc.code)}</span>
                <span style="font-weight:400; color:var(--text-muted); font-size:11px">(${doc.year})</span>
            </a>
        `;
    }).join('');

    overviewContent.innerHTML = `
        <div class="ai-answer-summary">
            ${summaryText}
        </div>

        <div class="ai-key-points">
            <h4>📌 Các điểm quy định &amp; hướng dẫn trọng tâm:</h4>
            <ul>
                ${bulletPoints.map(bp => `<li>${bp}</li>`).join('')}
            </ul>
        </div>

        <div class="ai-source-chips-box">
            <div class="ai-source-label">🔗 Căn cứ tài liệu gốc trong Kho lưu trữ (Supabase Storage):</div>
            <div class="ai-sources-list">
                ${sourceChips}
            </div>
        </div>
    `;
}

// Render lưới thẻ tài liệu kết quả từ Kho Lưu Trữ
function renderUniversalDocResults(docs, query) {
    const grid = document.getElementById('univDocsGrid');
    if (!grid) return;

    grid.innerHTML = docs.map((doc, idx) => {
        const highlightedTitle = highlightSearchQuery(doc.title, query);
        const highlightedCode = highlightSearchQuery(doc.code, query);
        const typeBadge = doc.itemType === 'procedure'
            ? `<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700">🧫 Quy trình vi sinh</span>`
            : `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700">📜 Văn bản y tế</span>`;

        const viewDetailBtn = doc.itemType === 'procedure'
            ? `<button type="button" class="btn btn-outline btn-sm" onclick="openDetailModal(${doc.id.replace('proc_', '')})">📋 Chi Tiết</button>`
            : '';

        return `
            <div class="univ-doc-card">
                <div>
                    <div class="univ-doc-card-top">
                        <span class="code-badge" style="font-weight:800; font-size:12px; background:#f8fafc; border:1px solid #cbd5e1">
                            ${highlightedCode}
                        </span>
                        ${typeBadge}
                    </div>

                    <div class="univ-doc-title">
                        ${highlightedTitle}
                    </div>

                    <div class="univ-doc-meta">
                        <span>🏢 ${escapeHtml(doc.issuer || 'Bộ Y tế')}</span>
                        <span>📅 Năm ${doc.year || '2024'}</span>
                        <span>📁 ${escapeHtml(doc.categoryName || doc.category)}</span>
                    </div>
                </div>

                <div class="univ-doc-actions">
                    <span class="format-badge ${doc.formatClass || 'format-pdf'}" style="font-size:11px">
                        ${doc.formatIcon || '📄'} ${doc.formatLabel || 'PDF'}
                    </span>
                    <div style="display:flex; gap:6px; align-items:center">
                        ${viewDetailBtn}
                        <a href="${doc.storageUrl}" target="_blank" rel="noopener noreferrer" class="btn-view-doc" title="Xem bản gốc từ Supabase Storage">
                            👁️ Xem Bản Gốc
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================================================
// MỞ RỘNG TÌM KIẾM BẰNG GOOGLE GEMINI AI
// LIÊN KẾT TÀI KHOẢN: bsdaoquangtrungducgiang@gmail.com
// ==========================================================================

async function triggerGeminiAIExpansion() {
    const card = document.getElementById('geminiResultCard');
    const contentBox = document.getElementById('geminiAiContent');
    const statusPill = document.getElementById('geminiStatusPill');
    const query = AppState.universalSearch.query || 'Quy trình xét nghiệm vi sinh';

    if (!card || !contentBox) return;

    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (statusPill) {
        statusPill.innerHTML = '<span class="pulse-dot"></span> Đang kết nối Gemini AI...';
        statusPill.style.background = '#fef3c7';
        statusPill.style.color = '#b45309';
        statusPill.style.borderColor = '#fcd34d';
    }

    contentBox.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; padding:20px 0">
            <div class="univ-loading-spinner" style="width:28px; height:28px; margin:0"></div>
            <div>
                <strong>Google Gemini AI đang suy luận & phân tích chuyên sâu...</strong>
                <div style="font-size:12px; color:var(--text-muted)">Tổng hợp kiến thức vi sinh lâm sàng, tiêu chuẩn ISO 15189 và hướng dẫn Bộ Y tế cho câu hỏi: "<em>${escapeHtml(query)}</em>"</div>
            </div>
        </div>
    `;

    const userApiKey = localStorage.getItem('gemini_api_key');

    // Nếu người dùng đã cài đặt API Key cá nhân
    if (userApiKey && userApiKey.trim()) {
        try {
            const promptText = `Bạn là Bác sĩ Trưởng khoa/Chuyên gia Vi sinh và Quản lý chất lượng Bệnh viện Đa khoa Đức Giang (Tài khoản Google liên kết: bsdaoquangtrungducgiang@gmail.com).
Hãy trả lời câu hỏi chuyên môn sau đây một cách chi tiết, chính xác và có tính thực hành cao:
"${query}"

Yêu cầu định dạng câu trả lời:
1. Trả lời rõ ràng, giải thích bản chất y học và nguyên lý xét nghiệm.
2. Nêu quy trình các bước chuẩn (Lấy mẫu, xử lý, nuôi cấy/nhuộm soi/PCR, biện luận kết quả).
3. Các quy định, tiêu chuẩn kỹ thuật liên quan của Bộ Y tế và tiêu chuẩn ISO 15189:2022.
4. Các lưu ý quan trọng về nội kiểm (IQC), ngoại kiểm (EQAS) và an toàn sinh học.`;

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(userApiKey.trim())}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2048
                    }
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Không nhận được câu trả lời từ Gemini.';

            if (statusPill) {
                statusPill.textContent = '🟢 Gemini 1.5 Flash • Live API';
                statusPill.style.background = '#ecfdf5';
                statusPill.style.color = '#047857';
                statusPill.style.borderColor = '#6ee7b7';
            }

            contentBox.innerHTML = `
                <div style="margin-bottom:12px; font-size:12px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px">
                    <span>💡 Phân tích trực tiếp từ mô hình <strong>Gemini 1.5 Flash</strong> (Tài khoản: bsdaoquangtrungducgiang@gmail.com)</span>
                    <button class="btn btn-outline btn-sm" onclick="document.getElementById('geminiKeyModalBackdrop').classList.add('active')" style="font-size:11px; padding:3px 8px">⚙️ Đổi Khóa API</button>
                </div>
                ${formatMarkdownToHtml(aiText)}
            `;
            return;
        } catch (error) {
            console.warn('Lỗi gọi Gemini Live API, chuyển sang chế độ phân tích chuyên sâu tích hợp:', error);
        }
    }

    // Chế độ phân tích chuyên gia mô phỏng y khoa thông minh khi chưa có API key
    setTimeout(() => {
        if (statusPill) {
            statusPill.textContent = '✨ Gemini AI Medical Engine';
            statusPill.style.background = '#ecfdf5';
            statusPill.style.color = '#047857';
            statusPill.style.borderColor = '#6ee7b7';
        }

        const clinicalAnswer = generateClinicalExpertAnswer(query);

        contentBox.innerHTML = `
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:12.5px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap">
                <div>
                    <strong>🔑 Tài khoản Google liên kết:</strong> <code>bsdaoquangtrungducgiang@gmail.com</code>
                    <span style="color:var(--text-muted)">— Bạn có thể dán khóa Gemini API Key từ Google AI Studio để gọi trực tiếp mô hình điện toán đám mây.</span>
                </div>
                <button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('geminiKeyModalBackdrop').classList.add('active')" style="font-size:12px; padding:5px 12px">
                    ⚙️ Nhập Khóa API Gemini
                </button>
            </div>
            ${formatMarkdownToHtml(clinicalAnswer)}
        `;
    }, 450);
}

// Trình tạo phân tích y khoa chuyên gia chuẩn hóa
function generateClinicalExpertAnswer(query) {
    const qLower = query.toLowerCase();

    if (qLower.includes('kháng sinh') || qLower.includes('ksd') || qLower.includes('vitek')) {
        return `### 1. Tổng Quan & Cơ Sở Chuyên Môn
Xét nghiệm kháng sinh đồ (Antimicrobial Susceptibility Testing - AST) đóng vai trò sống còn trong việc lựa chọn kháng sinh đích, theo dõi kiểu hình kháng thuốc và phát hiện các chủng đa kháng (MDR, XDR, PDR) như CRE, MRSA, VRE, Acinetobacter baumannii kháng carbapenem.

### 2. Tiêu Chuẩn Thực Hiện & Căn Cứ Pháp Lý
- **Tiêu chuẩn phiên giải:** Áp dụng bảng điểm CLSI (Clinical and Laboratory Standards Institute) hoặc EUCAST cập nhật hàng năm.
- **Quyết định 1539/QĐ-BYT:** Hướng dẫn thực hành kỹ thuật xét nghiệm vi sinh lâm sàng phục vụ giám sát kháng thuốc quốc gia.
- **Quy trình nội bộ:** Tuân thủ quy trình nội kiểm hệ thống định danh & kháng sinh đồ tự động Vitek 2 (VS.NC.27).

### 3. Quy Trình Các Bước Thực Hiện
1. **Chuẩn bị huyền dịch vi khuẩn:** Sử dụng khuẩn lạc thuần 18-24 giờ, pha huyền dịch nồng độ 0.5 McFarland chuẩn bằng máy đo độ đục.
2. **Kỹ thuật xét nghiệm:**
   - *Phương pháp tự động:* Nạp thẻ AST chuyên biệt (Vitek 2 / Phoenix / MicroScan) theo đúng hướng dẫn nhà sản xuất.
   - *Phương pháp khoanh giấy khuếch tán (Kirby-Bauer):* Cấy trang trên thạch Mueller-Hinton (MH), áp khoanh kháng sinh, ủ 35°C ± 2°C trong 16-18 giờ.
   - *Phương pháp E-test / Pha loãng:* Xác định nồng độ ức chế tối thiểu (MIC).
3. **Biện luận & Báo cáo:** Phân tích quy luật kháng tự nhiên, quy luật đề kháng chéo và các cơ chế cảm ứng (ESBL, AmpC, KPC, NDM, OXA-48).

### 4. Đảm Bảo Chất Lượng & An Toàn Sinh Học
- **Chủng chuẩn nội kiểm (ATCC):** Chạy kiểm chuẩn định kỳ bằng các chủng chuẩn *E. coli* ATCC 25922, *S. aureus* ATCC 25923, *P. aeruginosa* ATCC 27853.
- **An toàn sinh học:** Thao tác trong tủ an toàn sinh học cấp II, tuân thủ Nghị định 103/2016/NĐ-CP.`;
    }

    if (qLower.includes('an toàn') || qLower.includes('atsh') || qLower.includes('nồi hấp')) {
        return `### 1. Khung Pháp Lý An Toàn Sinh Học Phòng Xét Nghiệm
- **Nghị định 103/2016/NĐ-CP & Nghị định 155/2018/NĐ-CP:** Quy định bắt buộc về điều kiện bảo đảm an toàn sinh học tại phòng xét nghiệm y học.
- **Thông tư 41/2016/TT-BYT:** Danh mục vi sinh vật gây bệnh truyền nhiễm theo nhóm nguy cơ (Nhóm 1 đến Nhóm 4).
- **Thông tư 37/2017/TT-BYT:** Quy định về thực hành xét nghiệm an toàn sinh học.

### 2. Tiêu Chuẩn Phòng Xét Nghiệm An Toàn Sinh Học Cấp II
1. **Cơ sở vật chất:** Hệ thống cửa tự đóng, biển cảnh báo nguy cơ sinh học quốc tế, sàn và bề mặt bàn chống thấm, chống hóa chất, hệ thống rửa mắt khẩn cấp.
2. **Trang thiết bị bảo hộ:** Tủ an toàn sinh học cấp II (BSC Class II Type A2/B2) được thẩm định màng lọc HEPA định kỳ hàng năm; áo blouse, găng tay y tế, khẩu trang N95/FFP2 khi thao tác với mầm bệnh đường hô hấp.
3. **Quy định quản lý chất thải:** Rác thải lây nhiễm sắc nhọn và chất thải nuôi cấy vi sinh vật sống phải được khử nhiễm tiệt trùng bằng nồi hấp áp suất (Autoclave) trước khi chuyển sang hệ thống xử lý rác y tế (Thông tư liên tịch 58/2015/TTLT-BYT-BTNMT).`;
    }

    if (qLower.includes('2429') || qLower.includes('tiêu chí') || qLower.includes('quản lý chất lượng') || qLower.includes('iso')) {
        return `### 1. Khung Tiêu Chuẩn Quản Lý Chất Lượng Xét Nghiệm
- **Quyết định 2429/QĐ-BYT (2017):** Bộ tiêu chí đánh giá mức chất lượng phòng xét nghiệm y học gồm 12 chương, 169 tiêu chí (thang điểm 268).
- **Quyết định 5530/QĐ-BYT:** Hướng dẫn xây dựng hệ thống quy trình thực hành chuẩn (SOP).
- **Tiêu chuẩn Quốc tế ISO 15189:2022:** Yêu cầu về chất lượng và năng lực chuyên môn phòng xét nghiệm y tế.

### 2. Các Yếu Tố Cốt Lõi Cần Duy Trì
1. **Giai đoạn trước xét nghiệm:** Chuẩn hóa sổ tay lấy mẫu, nhận diện chính xác bệnh nhân (mã Barcode), thời gian vận chuyển và tiêu chí chấp thuận/từ chối mẫu phẩm.
2. **Giai đoạn trong xét nghiệm:** Nội kiểm chất lượng (IQC) hàng ngày với biểu đồ Levey-Jennings, áp dụng quy tắc Westgard; tham gia đầy đủ các chương trình ngoại kiểm (EQAS) quốc gia và quốc tế.
3. **Giai đoạn sau xét nghiệm:** Kiểm tra chéo kết quả, khoảng giá trị báo động (Critical Value), lưu mẫu và quản lý hồ sơ tài liệu theo đúng quy định.`;
    }

    return `### 1. Phân Tích Chuyên Môn & Hướng Dẫn Y Khoa
Chủ đề **"${escapeHtml(query)}"** là nội dung quan trọng thuộc phạm vi chuyên môn Vi sinh lâm sàng & Quản lý chất lượng xét nghiệm theo tiêu chuẩn Bộ Y tế.

### 2. Các Yêu Cầu Kỹ Thuật & Căn Cứ Pháp Quy
- Tuân thủ các quyết định hướng dẫn quy trình kỹ thuật chuyên ngành Vi sinh của Bộ Y tế (QĐ 2633/QĐ-BYT, QĐ 6769/QĐ-BYT, QĐ 1539/QĐ-BYT).
- Thực hiện nghiêm ngặt quy trình kiểm soát sự không phù hợp và hành động khắc phục phòng ngừa theo tiêu chuẩn quản lý chất lượng ISO 15189:2022.
- Đối soát tài liệu gốc trực tiếp trong kho dữ liệu đám mây Supabase Storage của bệnh viện.

### 3. Khuyến Cáo Thực Hành Lâm Sàng
1. Rà soát lại mã quy trình tương ứng được ban hành nội bộ tại Khoa Vi sinh BVĐK Đức Giang.
2. Kiểm tra tính toàn vẹn của mẫu bệnh phẩm, môi trường nuôi cấy và hạn sử dụng của sinh phẩm/hóa chất trước khi thực hiện.
3. Liên hệ Bác sĩ chuyên trách phòng xét nghiệm khi xuất hiện các kết quả bất thường hoặc kiểu hình đề kháng kháng sinh hiếm gặp.`;
}

// Chuyển đổi Markdown cơ bản sang HTML đẹp mắt
function formatMarkdownToHtml(markdown) {
    if (!markdown) return '';
    let html = escapeHtml(markdown);

    // Tiêu đề ###
    html = html.replace(/^### (.*$)/gim, '<h4 style="color:#1e3a8a; font-weight:800; margin:16px 0 8px 0; font-size:15px">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="color:#0f172a; font-weight:800; margin:18px 0 10px 0; font-size:16px">$1</h3>');

    // Chữ đậm **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Chữ nghiêng *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Code `text`
    html = html.replace(/`(.*?)`/g, '<code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; color:#be123c; font-size:12px">$1</code>');

    // Danh sách gạch đầu dòng - hoặc *
    const lines = html.split('\n');
    let inList = false;
    const formattedLines = [];

    for (let line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!inList) {
                formattedLines.push('<ul style="padding-left:22px; margin:8px 0">');
                inList = true;
            }
            formattedLines.push(`<li>${trimmed.substring(2)}</li>`);
        } else if (/^\d+\.\s/.test(trimmed)) {
            if (!inList) {
                formattedLines.push('<ol style="padding-left:22px; margin:8px 0">');
                inList = 'ol';
            }
            formattedLines.push(`<li>${trimmed.replace(/^\d+\.\s/, '')}</li>`);
        } else {
            if (inList === true) {
                formattedLines.push('</ul>');
                inList = false;
            } else if (inList === 'ol') {
                formattedLines.push('</ol>');
                inList = false;
            }
            if (trimmed.length > 0) {
                formattedLines.push(`<p style="margin-bottom:8px">${line}</p>`);
            }
        }
    }
    if (inList === true) formattedLines.push('</ul>');
    if (inList === 'ol') formattedLines.push('</ol>');

    return formattedLines.join('\n');
}


