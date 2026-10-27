/**
 * Cấu hình Supabase Client
 * Dự án: Bs Trung Project - Quản lý Quy Trình xét nghiệm Vi sinh
 */

const SUPABASE_CONFIG = {
    url: 'https://wbzjkwudiaeisujoimfi.supabase.co',
    key: 'sb_publishable_HppbYtatmqwp1J3AdKvPkQ_txIxguvc'
};

let supabaseClient = null;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
        console.log('✅ Supabase Client initialized successfully.');
    } else {
        console.warn('⚠️ Supabase library not loaded yet, will initialize when ready.');
    }
} catch (err) {
    console.error('❌ Failed to initialize Supabase client:', err);
}

// Hàm khởi tạo Supabase nếu script CDN nạp trễ
function getSupabase() {
    if (!supabaseClient && window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    }
    return supabaseClient;
}
