/**
 * Ứng dụng Quản lý Quy Trình Xét Nghiệm Vi Sinh
 * Khoa Vi Sinh - Bệnh Viện Đa Khoa Đức Giang
 * Tác giả: BS.CK2. Đào Quang Trung & Đội ngũ CNTT
 */

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
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // Huyền, sắc, ngã, hỏi, nặng
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // Â, Ê, Ă, Ơ, Ư
    return str.trim();
}

// State Quản lý ứng dụng
const AppState = {
    procedures: typeof PROCEDURES_DATA !== 'undefined' ? PROCEDURES_DATA : [],
    filteredProcedures: [],
    selectedCategory: 'all',
    selectedType: 'all',
    selectedYear: 'all',
    searchQuery: '',
    sortBy: 'code_asc',
    viewMode: 'grid', // 'grid' | 'table'
    charts: {
        categoryChart: null,
        typeChart: null
    },
    tasks: [],
    employees: []
};

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initKPIs();
    initFilterOptions();
    initEventListeners();
    initCharts();
    filterAndRender();
    initSupabaseData();
});

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
    const catCounts = {
        all: total,
        'Quản Lý Chất Lượng': ql,
        'Miễn Dịch': AppState.procedures.filter(p => p.category === 'Miễn Dịch').length,
        'Nuôi Cấy': AppState.procedures.filter(p => p.category === 'Nuôi Cấy').length,
        'Nhuộm Soi': AppState.procedures.filter(p => p.category === 'Nhuộm Soi').length,
        'Sinh Học Phân Tử (PCR)': AppState.procedures.filter(p => p.category === 'Sinh Học Phân Tử (PCR)').length
    };

    document.querySelectorAll('.cat-pill').forEach(pill => {
        const cat = pill.getAttribute('data-category');
        const countSpan = pill.querySelector('.count');
        if (countSpan && catCounts[cat] !== undefined) {
            countSpan.textContent = catCounts[cat];
        }
    });
}

// 3. Khởi tạo danh sách bộ lọc Loại quy trình & Năm
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

// 4. Biểu đồ Chart.js
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
                        '#10b981', // Nuôi cấy - Green
                        '#ef4444', // QLCL - Red/Rose
                        '#6366f1', // Miễn dịch - Indigo
                        '#f59e0b', // Nhuộm soi - Amber
                        '#0284c7'  // PCR - Sky blue
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
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

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

// 5. Tìm kiếm & Lọc Quy Trình
function initEventListeners() {
    // Search input
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

    // Category pills
    document.querySelectorAll('.cat-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            AppState.selectedCategory = pill.getAttribute('data-category');
            filterAndRender();
        });
    });

    // Dropdowns
    document.getElementById('typeFilterSelect').addEventListener('change', (e) => {
        AppState.selectedType = e.target.value;
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

    // View modes
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

    // Reset filter button
    document.getElementById('resetFilterBtn').addEventListener('click', () => {
        searchInput.value = '';
        AppState.searchQuery = '';
        clearBtn.classList.remove('visible');
        AppState.selectedCategory = 'all';
        AppState.selectedType = 'all';
        AppState.selectedYear = 'all';
        AppState.sortBy = 'code_asc';

        document.querySelectorAll('.cat-pill').forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-category') === 'all');
        });
        document.getElementById('typeFilterSelect').value = 'all';
        document.getElementById('yearFilterSelect').value = 'all';
        document.getElementById('sortFilterSelect').value = 'code_asc';

        filterAndRender();
    });

    // Modal close
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

    // Task Form Submit
    document.getElementById('addTaskForm').addEventListener('submit', handleAddTaskSubmit);
}

function filterAndRender() {
    const rawQuery = removeVietnameseTones(AppState.searchQuery.trim());

    AppState.filteredProcedures = AppState.procedures.filter(p => {
        // Lọc category
        if (AppState.selectedCategory !== 'all' && p.category !== AppState.selectedCategory) {
            return false;
        }
        // Lọc type
        if (AppState.selectedType !== 'all' && p.type !== AppState.selectedType) {
            return false;
        }
        // Lọc year
        if (AppState.selectedYear !== 'all' && p.year.toString() !== AppState.selectedYear.toString()) {
            return false;
        }
        // Tìm kiếm thông minh
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

    // Sắp xếp
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

        gridContainer.innerHTML = AppState.filteredProcedures.map(p => `
            <div class="proc-card">
                <div>
                    <div class="proc-card-header">
                        <span class="sop-code">${p.code || 'SOP'}</span>
                        <span class="proc-badge ${getCategoryBadgeClass(p.category)}">${p.category}</span>
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
                    <a href="${encodeURI(p.path)}" target="_blank" class="btn btn-primary btn-sm" style="flex:1">
                        📄 Mở File PDF
                    </a>
                    <button onclick="openProcedureDetail(${p.id})" class="btn btn-outline btn-sm">
                        🔍 Chi tiết
                    </button>
                </div>
            </div>
        `).join('');
    } else {
        gridContainer.style.display = 'none';
        tableContainer.style.display = 'block';

        const tbody = document.getElementById('proceduresTableBody');
        tbody.innerHTML = AppState.filteredProcedures.map(p => `
            <tr>
                <td style="font-weight:700; font-family:monospace">${p.code || 'SOP'}</td>
                <td style="font-weight:600">${p.title}</td>
                <td><span class="proc-badge ${getCategoryBadgeClass(p.category)}">${p.category}</span></td>
                <td>${p.type}</td>
                <td><span style="font-weight:600">${p.year}</span></td>
                <td>
                    <div style="display:flex; gap:6px">
                        <a href="${encodeURI(p.path)}" target="_blank" class="btn btn-primary btn-sm">
                            📄 Mở PDF
                        </a>
                        <button onclick="openProcedureDetail(${p.id})" class="btn btn-outline btn-sm">
                            🔍
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// 6. Modal Chi tiết Quy Trình
function openProcedureDetail(procId) {
    const p = AppState.procedures.find(item => item.id === procId);
    if (!p) return;

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
    openPdfBtn.href = encodeURI(p.path);

    document.getElementById('detailModalBackdrop').classList.add('active');
}

function closeModal() {
    document.getElementById('detailModalBackdrop').classList.remove('active');
}

// 7. Đồng Bộ & Tương Tác Dữ Liệu Supabase
async function initSupabaseData() {
    const client = getSupabase();
    const badge = document.getElementById('supabaseStatusBadge');
    
    if (!client) {
        console.warn('Supabase client not available, running in Local Cache mode.');
        if (badge) {
            badge.innerHTML = '<span class="pulse-dot" style="background-color:#f59e0b"></span> Local Mode';
        }
        loadTasksFromLocalStorage();
        return;
    }

    try {
        // Tải danh sách nhân sự từ Supabase
        const { data: empData, error: empErr } = await client
            .from('employees')
            .select('*')
            .eq('active', true);
            
        if (!empErr && empData && empData.length > 0) {
            AppState.employees = empData;
            populateAssigneeSelect(empData);
        } else {
            // Mặc định bác sĩ Trung
            AppState.employees = [
                { name: 'BS.CK2. Đào Quang Trung', position: 'Trưởng khoa Vi sinh' },
                { name: 'BS. Chu Thị Huyền', position: 'Bác sĩ Vi sinh' }
            ];
            populateAssigneeSelect(AppState.employees);
        }

        // Tải danh sách nhiệm vụ / ghi nhớ quy trình từ Supabase
        await fetchTasksFromSupabase();

        if (badge) {
            badge.innerHTML = '<span class="pulse-dot"></span> Supabase Connected';
        }
    } catch (err) {
        console.error('Lỗi khi kết nối Supabase:', err);
        if (badge) {
            badge.innerHTML = '<span class="pulse-dot" style="background-color:#f59e0b"></span> Offline Mode';
        }
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
            // Fallback lưu local
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
