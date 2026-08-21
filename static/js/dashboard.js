/**
 * ============================================
 * DASHBOARD.JS - Halaman Dashboard SecureCloud
 * ============================================
 */

(function () {
    'use strict';

    // ============================================
    // AUTH GUARD
    // ============================================
const currentUserRaw = sessionStorage.getItem('currentUser');
if (!currentUserRaw) {
    // 🔥 Cek apakah session Django masih aktif
    fetch(`${API_BASE_URL}/accounts/current-user/`, {
        method: 'GET',
        credentials: 'include',
    })
    .then(response => {
        if (response.ok) {
            // Session Django aktif, tapi sessionStorage kosong
            // Coba restore user data dari server
            return response.json();
        } else {
            // Session Django tidak aktif, redirect ke login
            window.location.href = '/login/';
            return null;
        }
    })
    .then(data => {
        if (data && data.success) {
            // Restore sessionStorage
            sessionStorage.setItem('currentUser', JSON.stringify({
                email: data.email,
                username: data.username
            }));
            // Refresh halaman
            window.location.reload();
        } else if (data === null) {
            // Sudah redirect ke login
            return;
        }
    })
    .catch(() => {
        window.location.href = '/login/';
    });
    return;
}
const currentUser = JSON.parse(currentUserRaw);
const ownerEmail = currentUser.email;

    // ============================================
    // KONSTANTA
    // ============================================
    // Gunakan host yang SAMA dengan halaman saat ini agar cookie session
    // (SESSION_COOKIE_SAMESITE = 'Lax') tidak diblokir browser sebagai
    // request cross-site (localhost vs 127.0.0.1 dianggap origin berbeda).
    const API_BASE_URL = window.location.origin + '/api';
    // Kuota mengikuti batas storage bucket Supabase (Free tier = 1 GB).
    // Kalau paket Supabase-nya naik ke Pro, cukup ubah angka ini saja.
    const QUOTA_BYTES = 1024 * 1024 * 1024;

    const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
    const TEXT_EXT = ['txt', 'md', 'json', 'js', 'css', 'html', 'csv', 'xml', 'log', 'py', 'java', 'c', 'cpp', 'yml', 'yaml', 'ini'];
    const PDF_EXT = ['pdf'];
    const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a'];
    const VIDEO_EXT = ['mp4', 'webm', 'mov', 'mkv'];

    const ICON_MAP = {
        pdf: { icon: 'fa-file-pdf', color: '#EF4444' },
        doc: { icon: 'fa-file-word', color: '#2563EB' },
        docx: { icon: 'fa-file-word', color: '#2563EB' },
        xls: { icon: 'fa-file-excel', color: '#10B981' },
        xlsx: { icon: 'fa-file-excel', color: '#10B981' },
        csv: { icon: 'fa-file-csv', color: '#10B981' },
        ppt: { icon: 'fa-file-powerpoint', color: '#F97316' },
        pptx: { icon: 'fa-file-powerpoint', color: '#F97316' },
        zip: { icon: 'fa-file-zipper', color: '#F59E0B' },
        rar: { icon: 'fa-file-zipper', color: '#F59E0B' },
        '7z': { icon: 'fa-file-zipper', color: '#F59E0B' },
        mp3: { icon: 'fa-file-audio', color: '#EC4899' },
        wav: { icon: 'fa-file-audio', color: '#EC4899' },
        ogg: { icon: 'fa-file-audio', color: '#EC4899' },
        mp4: { icon: 'fa-file-video', color: '#7C3AED' },
        mov: { icon: 'fa-file-video', color: '#7C3AED' },
        webm: { icon: 'fa-file-video', color: '#7C3AED' },
        txt: { icon: 'fa-file-lines', color: '#64748B' },
        md: { icon: 'fa-file-lines', color: '#64748B' },
        js: { icon: 'fa-file-code', color: '#EAB308' },
        json: { icon: 'fa-file-code', color: '#EAB308' },
        html: { icon: 'fa-file-code', color: '#EAB308' },
        css: { icon: 'fa-file-code', color: '#EAB308' },
        py: { icon: 'fa-file-code', color: '#EAB308' },
        default: { icon: 'fa-file', color: '#2563EB' }
    };

    // ============================================
    // STATE
    // ============================================
    let allFiles = [];
    let currentFilter = 'all';
    let currentSort = 'date_desc';
    let searchTerm = '';
    let activeFileId = null;
    let masterKey = null;

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function getExt(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }

    function isImage(ext) { return IMAGE_EXT.includes(ext); }
    function isText(ext) { return TEXT_EXT.includes(ext); }
    function isPdf(ext) { return PDF_EXT.includes(ext); }
    function isAudio(ext) { return AUDIO_EXT.includes(ext); }
    function isVideo(ext) { return VIDEO_EXT.includes(ext); }

    function categoryOf(ext) {
        if (isImage(ext)) return 'image';
        if (isText(ext) || isPdf(ext) || ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document';
        return 'other';
    }

    function iconFor(ext) {
        return ICON_MAP[ext] || ICON_MAP.default;
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
    }

    function formatDate(iso) {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) +
            ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    function uuid() {
        return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================
    // MANAJEMEN KUNCI
    // ============================================
    function getMasterKey() {
        if (masterKey) return masterKey;
        
        const storageKey = 'secureCloudKey:' + ownerEmail;
        let b64 = localStorage.getItem(storageKey);
        if (!b64) {
            const key = ChaCha20Poly1305.generateKey();
            b64 = ChaCha20Poly1305.bytesToBase64(key);
            localStorage.setItem(storageKey, b64);
            return key;
        }
        masterKey = ChaCha20Poly1305.base64ToBytes(b64);
        return masterKey;
    }

    const MASTER_KEY = getMasterKey();

// ============================================
// CSRF TOKEN HELPER
// ============================================
function getCSRFToken() {
    // Cara 1: Dari cookie
    const name = 'csrftoken';
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith(name + '='));

    if (cookieValue) {
        return cookieValue.split('=')[1];
    }

    // Cara 2: Dari meta tag (jika ada)
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }

    console.warn('⚠️ CSRF token not found');
    return null;
}

// ============================================
// AMBIL CSRF TOKEN DARI SERVER (jika tidak ada)
// ============================================
async function ensureCSRFToken() {
    let token = getCSRFToken();
    if (token) return token;

    try {
        const response = await fetch(`${API_BASE_URL}/accounts/csrf-token/`, {
            method: 'GET',
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            token = data.csrf_token;
            console.log('✅ CSRF token fetched from server');
            return token;
        }
    } catch (err) {
        console.warn('⚠️ Failed to fetch CSRF token:', err);
    }

    return null;
}

    // ============================================
    // ENKRIPSI / DEKRIPSI FILE
    // ============================================
    function buildAad(name, owner) {
        return new TextEncoder().encode(owner + '::' + name);
    }

    async function encryptBuffer(arrayBuffer, name, owner) {
        const nonce = ChaCha20Poly1305.generateNonce();
        const plaintext = new Uint8Array(arrayBuffer);
        const aad = buildAad(name, owner);
        const cipherWithTag = ChaCha20Poly1305.encrypt(MASTER_KEY, nonce, plaintext, aad);
        return { nonce, cipherWithTag };
    }

    function decryptBuffer(cipherWithTag, nonce, name, owner) {
        const aad = buildAad(name, owner);
        return ChaCha20Poly1305.decrypt(MASTER_KEY, nonce, cipherWithTag, aad);
    }

    // ============================================
    // API CALLS
    // ============================================
async function uploadFileToServer(fileRecord, ciphertextBlob) {
    try {
        // Ambil CSRF token
        const csrfToken = await ensureCSRFToken();
        
        const formData = new FormData();
        formData.append('id', fileRecord.id);
        formData.append('original_name', fileRecord.original_name);
        formData.append('file_size', fileRecord.file_size);
        formData.append('file_ext', fileRecord.file_ext || '');
        formData.append('file_category', fileRecord.file_category || '');
        formData.append('mime_type', fileRecord.mime_type || '');
        formData.append('nonce', fileRecord.nonce);
        formData.append('ciphertext', ciphertextBlob, `${fileRecord.id}.enc`);
        
        const headers = {
            'X-CSRFToken': csrfToken || '',
        };
        
        const response = await fetch(`${API_BASE_URL}/accounts/files/upload/`, {
            method: 'POST',
            headers: headers,
            credentials: 'include',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Upload error response:', errorText);
            throw new Error(`Upload failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📦 Upload response:', data);
        return data;
    } catch (error) {
        console.error('❌ Upload error:', error);
        throw error;
    }
}

    async function getFilesFromServer() {
        try {
            const response = await fetch(`${API_BASE_URL}/accounts/files/list/`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            
            console.log('📡 Response status:', response.status);
            
            // JANGAN REDIRECT, return data kosong untuk error auth
            if (response.status === 403 || response.status === 401) {
                console.warn('⚠️ Auth error - returning empty data');
                return { success: true, data: [], count: 0 };
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Error response:', errorData);
                return { success: true, data: [], count: 0 };
            }
            
            const data = await response.json();
            console.log('📦 Files from server:', data);
            return data;
        } catch (error) {
            console.error('❌ Error fetching files:', error);
            return { success: true, data: [], count: 0 };
        }
    }

    async function downloadFileFromServer(fileId) {
        try {
            const response = await fetch(`${API_BASE_URL}/accounts/files/download/${fileId}/`, {
                method: 'GET',
                credentials: 'include',
            });
            
            if (!response.ok) {
                throw new Error('Download failed');
            }
            
            const nonce = response.headers.get('X-Nonce');
            const originalName = response.headers.get('X-Original-Name');
            const blob = await response.blob();
            
            return {
                success: true,
                blob: blob,
                nonce: nonce,
                originalName: originalName,
                fileId: fileId
            };
        } catch (error) {
            console.error('❌ Download error:', error);
            return { success: false, error: error.message };
        }
    }

async function deleteFileFromServer(fileId) {
    try {
        const csrfToken = await ensureCSRFToken();
        
        const response = await fetch(`${API_BASE_URL}/accounts/files/delete/${fileId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrfToken || '',
            },
            credentials: 'include',
        });
        const data = await response.json();
        console.log('🗑️ Delete response:', data);
        return data;
    } catch (error) {
        console.error('❌ Delete error:', error);
        return { success: false };
    }
}

async function renameFileOnServer(fileId, newName) {
    try {
        const csrfToken = await ensureCSRFToken();
        
        const response = await fetch(`${API_BASE_URL}/accounts/files/rename/${fileId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken || '',
            },
            credentials: 'include',
            body: JSON.stringify({ new_name: newName })
        });
        const data = await response.json();
        console.log('✏️ Rename response:', data);
        return data;
    } catch (error) {
        console.error('❌ Rename error:', error);
        return { success: false };
    }
}

async function editFileOnServer(fileId, newCiphertextBase64, newNonce) {
    try {
        const csrfToken = await ensureCSRFToken();
        
        const response = await fetch(`${API_BASE_URL}/accounts/files/edit/${fileId}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                // 'X-CSRFToken': csrfToken || '',
            },
            credentials: 'include',
            body: JSON.stringify({
                ciphertext: newCiphertextBase64,
                nonce: newNonce
            })
        });
        const data = await response.json();
        console.log('✏️ Edit response:', data);
        return data;
    } catch (error) {
        console.error('❌ Edit error:', error);
        return { success: false };
    }
}

    // ============================================
    // UPLOAD FILE
    // ============================================
    function renderUploadQueueItem(id, name, iconMeta) {
        const wrap = document.createElement('div');
        wrap.className = 'upload-item';
        wrap.id = 'upload-' + id;
        wrap.innerHTML =
            '<i class="fas ' + iconMeta.icon + ' file-type-icon" style="color:' + iconMeta.color + '"></i>' +
            '<div class="upload-item-info">' +
                '<div class="upload-item-name">' + escapeHtml(name) + '</div>' +
                '<div class="upload-item-status">Menyiapkan...</div>' +
                '<div class="upload-progress-track"><div class="upload-progress-fill"></div></div>' +
            '</div>' +
            '<i class="fas fa-check-circle upload-item-check"></i>';
        document.getElementById('uploadQueue').appendChild(wrap);
        return wrap;
    }

    function setUploadStatus(el, text, percent, state) {
        el.querySelector('.upload-item-status').textContent = text;
        el.querySelector('.upload-progress-fill').style.width = percent + '%';
        if (state) el.classList.add(state);
    }

    async function handleFiles(fileList) {
        const files = Array.from(fileList);
        if (files.length === 0) return;

        for (const file of files) {
            await uploadSingleFile(file);
        }
        await refreshFiles();
    }

    async function uploadSingleFile(file) {
        const id = uuid();
        const ext = getExt(file.name);
        const queueEl = renderUploadQueueItem(id, file.name, iconFor(ext));

        try {
            setUploadStatus(queueEl, 'Membaca file...', 10);
            const arrayBuffer = await file.arrayBuffer();

            setUploadStatus(queueEl, 'Mengenkripsi (ChaCha20-Poly1305)...', 30);
            const { nonce, cipherWithTag } = await encryptBuffer(arrayBuffer, file.name, ownerEmail);
            
            const ciphertextBlob = new Blob([cipherWithTag], { type: 'application/octet-stream' });
            
            setUploadStatus(queueEl, 'Mengupload ke cloud storage...', 60);
            
            const fileRecord = {
                id: id,
                original_name: file.name,
                file_size: file.size,
                file_ext: ext,
                file_category: categoryOf(ext),
                mime_type: file.type || 'application/octet-stream',
                nonce: ChaCha20Poly1305.bytesToBase64(nonce)
            };
            
            const result = await uploadFileToServer(fileRecord, ciphertextBlob);
            
            if (result && result.success) {
                setUploadStatus(queueEl, '✅ Berhasil diupload & dienkripsi', 100, 'done');
                setTimeout(() => queueEl.remove(), 2000);
                await refreshFiles();
            } else {
                throw new Error(result?.message || 'Upload failed');
            }
            
        } catch (err) {
            console.error('❌ Upload error:', err);
            setUploadStatus(queueEl, '❌ Gagal: ' + err.message, 100, 'error');
            showAlert('danger', 'Gagal upload ' + file.name + ': ' + err.message);
        }
    }

    // ============================================
    // RENDER GRID
    // ============================================
    async function refreshFiles() {
        console.log('🔄 Refreshing files...');
        
        // Cleanup old thumbnails
        cleanupThumbnails();
        
        const result = await getFilesFromServer();
        
        // SELALU set allFiles, meskipun error
        if (result && result.success) {
            allFiles = result.data || [];
        } else {
            allFiles = [];
            console.warn('⚠️ Failed to load files, using empty list');
        }
        
        renderGrid();
        renderStorage();
    }

    function getFilteredSortedFiles() {
        let list = allFiles.slice();

        if (currentFilter !== 'all') {
            list = list.filter((f) => f.file_category === currentFilter);
        }
        if (searchTerm.trim() !== '') {
            const q = searchTerm.trim().toLowerCase();
            list = list.filter((f) => f.original_name.toLowerCase().includes(q));
        }

        switch (currentSort) {
            case 'date_asc': list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
            case 'name_asc': list.sort((a, b) => a.original_name.localeCompare(b.original_name)); break;
            case 'name_desc': list.sort((a, b) => b.original_name.localeCompare(a.original_name)); break;
            case 'size_desc': list.sort((a, b) => b.file_size - a.file_size); break;
            default: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        return list;
    }

// ============================================
// FUNGSI TAMBAHAN UNTUK WARNA IKON
// ============================================
function getFileIconColor(ext) {
    const colors = {
        pdf: '#EF4444',
        doc: '#2563EB',
        docx: '#2563EB',
        xls: '#10B981',
        xlsx: '#10B981',
        ppt: '#F97316',
        pptx: '#F97316',
        zip: '#F59E0B',
        rar: '#F59E0B',
        '7z': '#F59E0B',
        mp3: '#EC4899',
        wav: '#EC4899',
        ogg: '#EC4899',
        mp4: '#7C3AED',
        mov: '#7C3AED',
        webm: '#7C3AED',
        png: '#2563EB',
        jpg: '#2563EB',
        jpeg: '#2563EB',
        gif: '#2563EB',
        webp: '#2563EB',
        svg: '#2563EB',
        bmp: '#2563EB',
        txt: '#64748B',
        md: '#64748B',
        js: '#EAB308',
        json: '#EAB308',
        html: '#EAB308',
        css: '#EAB308',
        py: '#EAB308',
        default: '#64748B'
    };
    return colors[ext] || colors.default;
}

// ============================================
// FUNGSI LOAD THUMBNAIL
// ============================================
async function loadThumbnail(fileId, record, imgElement) {
    const skeleton = imgElement.closest('.file-cover').querySelector('.thumbnail-skeleton');
    if (skeleton) skeleton.classList.add('active');
    
    try {
        imgElement.classList.add('loading');
        
        const result = await downloadFileFromServer(fileId);
        
        if (!result.success) {
            throw new Error('Failed to load thumbnail');
        }
        
        const nonce = ChaCha20Poly1305.base64ToBytes(record.nonce);
        const ciphertext = await result.blob.arrayBuffer();
        const cipherArray = new Uint8Array(ciphertext);
        
        const plain = decryptBuffer(cipherArray, nonce, record.original_name, ownerEmail);
        
        const ext = record.file_ext;
        
        // Untuk PDF - generate thumbnail dari halaman pertama
        if (isPdf(ext)) {
            try {
                const pdfBlob = new Blob([plain], { type: 'application/pdf' });
                const pdfUrl = URL.createObjectURL(pdfBlob);
                
                // Gunakan pdf.js untuk render halaman pertama sebagai thumbnail
                const thumbnailUrl = await generatePdfThumbnail(pdfUrl);
                
                if (thumbnailUrl) {
                    imgElement.src = thumbnailUrl;
                    imgElement.classList.remove('hidden', 'loading');
                    imgElement.classList.add('loaded');
                    
                    // Sembunyikan icon wrap
                    const iconWrap = imgElement.closest('.file-cover').querySelector('.cover-icon-wrap');
                    if (iconWrap) {
                        iconWrap.style.display = 'none';
                    }
                    
                    imgElement.dataset.objectUrl = thumbnailUrl;
                    if (skeleton) skeleton.classList.remove('active');
                    return;
                }
            } catch (pdfErr) {
                console.warn('PDF thumbnail generation failed:', pdfErr);
                // Fallback ke icon
            }
        }
        
        // Untuk gambar - langsung tampilkan
        if (isImage(ext)) {
            const blob = new Blob([plain], { type: record.mime_type || 'image/*' });
            const url = URL.createObjectURL(blob);
            
            imgElement.src = url;
            imgElement.classList.remove('hidden', 'loading');
            imgElement.classList.add('loaded');
            
            // Sembunyikan icon wrap
            const iconWrap = imgElement.closest('.file-cover').querySelector('.cover-icon-wrap');
            if (iconWrap) {
                iconWrap.style.display = 'none';
            }
            
            imgElement.dataset.objectUrl = url;
            if (skeleton) skeleton.classList.remove('active');
            return;
        }
        
        // Jika gagal generate thumbnail, tampilkan icon
        throw new Error('Thumbnail not available');
        
    } catch (err) {
        console.warn('Failed to load thumbnail for:', record.original_name, err.message);
        // Tampilkan fallback icon
        const cover = imgElement.closest('.file-cover');
        const iconWrap = cover.querySelector('.cover-icon-wrap');
        if (iconWrap) {
            iconWrap.style.display = 'flex';
        }
        imgElement.classList.add('hidden');
        if (skeleton) skeleton.classList.remove('active');
    }
}

// ============================================
// FUNGSI GENERATE PDF THUMBNAIL
// ============================================
async function generatePdfThumbnail(pdfUrl) {
    try {
        // Cek apakah pdf.js tersedia
        if (typeof pdfjsLib === 'undefined') {
            // Jika tidak ada, coba load dari CDN
            await loadPdfJs();
        }
        
        // Load PDF
        const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        const page = await pdf.getPage(1);
        
        // Set scale untuk thumbnail
        const scale = 0.5;
        const viewport = page.getViewport({ scale });
        
        // Render ke canvas
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Convert ke data URL
        return canvas.toDataURL('image/jpeg', 0.7);
        
    } catch (err) {
        console.warn('PDF thumbnail generation error:', err);
        return null;
    }
}

// ============================================
// FUNGSI LOAD PDF.JS
// ============================================
function loadPdfJs() {
    return new Promise((resolve, reject) => {
        // Cek apakah sudah ada
        if (typeof pdfjsLib !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            // Set worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ============================================
// RENDER GRID - UPDATED (support PDF thumbnail)
// ============================================
function renderGrid() {
    const grid = document.getElementById('fileGrid');
    const empty = document.getElementById('emptyState');
    const list = getFilteredSortedFiles();

    grid.innerHTML = '';
    document.getElementById('fileCount').textContent = list.length + ' item';

    if (allFiles.length === 0) {
        empty.style.display = 'block';
        grid.style.display = 'none';
        return;
    }
    empty.style.display = 'none';
    grid.style.display = 'grid';

    const template = document.getElementById('fileCardTemplate');

    list.forEach((record) => {
        const node = template.content.cloneNode(true);
        const card = node.querySelector('.file-card');
        card.dataset.id = record.id;

        // File name
        const fileNameEl = node.querySelector('.file-name');
        fileNameEl.textContent = record.original_name;
        fileNameEl.title = record.original_name;

        // File meta
        node.querySelector('.file-size').textContent = formatBytes(record.file_size);
        node.querySelector('.file-date').textContent = formatDate(record.created_at);

        const ext = record.file_ext;
        const iconMeta = iconFor(ext);
        const iconColor = getFileIconColor(ext);

        // Cover icon
        const iconWrap = node.querySelector('.cover-icon-wrap');
        const iconEl = iconWrap.querySelector('.file-icon-big');
        const extBadge = iconWrap.querySelector('.file-ext-badge');
        
        if (iconEl) {
            iconEl.className = 'fas ' + iconMeta.icon + ' file-icon-big';
            iconEl.style.color = iconColor;
        }
        if (extBadge) {
            extBadge.textContent = ext.toUpperCase() || 'FILE';
        }

        // Thumbnail image
        const imgEl = node.querySelector('.cover-img');
        const cover = node.querySelector('.file-cover');
        
        // Cek apakah file bisa ditampilkan thumbnail-nya
        if (isImage(ext) || isPdf(ext)) {
            // Tampilkan thumbnail
            imgEl.classList.remove('hidden');
            iconWrap.style.display = 'none';
            
            // Tambah class khusus untuk PDF
            if (isPdf(ext)) {
                cover.classList.add('pdf-thumbnail');
            }
            
            // Load thumbnail secara async
            loadThumbnail(record.id, record, imgEl);
        } else if (isVideo(ext)) {
            // Video - tampilkan ikon video
            iconWrap.style.display = 'flex';
            if (iconEl) {
                iconEl.className = 'fas fa-file-video file-icon-big';
                iconEl.style.color = '#7C3AED';
            }
            if (extBadge) {
                extBadge.textContent = ext.toUpperCase();
            }
            imgEl.classList.add('hidden');
        } else if (isAudio(ext)) {
            // Audio - tampilkan ikon audio
            iconWrap.style.display = 'flex';
            if (iconEl) {
                iconEl.className = 'fas fa-file-audio file-icon-big';
                iconEl.style.color = '#EC4899';
            }
            if (extBadge) {
                extBadge.textContent = ext.toUpperCase();
            }
            imgEl.classList.add('hidden');
        } else {
            // File lain - tampilkan ikon default
            iconWrap.style.display = 'flex';
            imgEl.classList.add('hidden');
        }

        grid.appendChild(node);
    });
}

// ============================================
// CLEANUP THUMBNAILS
// ============================================
function cleanupThumbnails() {
    document.querySelectorAll('.cover-img[data-object-url]').forEach((img) => {
        const url = img.dataset.objectUrl;
        if (url) {
            URL.revokeObjectURL(url);
            delete img.dataset.objectUrl;
        }
    });
}

    function renderStorage() {
        const totalBytes = allFiles.reduce((sum, f) => sum + f.file_size, 0);
        const pct = Math.min(100, (totalBytes / QUOTA_BYTES) * 100);
        const fillEl = document.getElementById('storageFill');
        const textEl = document.getElementById('storageText');

        fillEl.style.width = pct + '%';
        textEl.textContent = formatBytes(totalBytes) + ' / ' + formatBytes(QUOTA_BYTES);

        // Beri warna peringatan saat storage hampir penuh
        fillEl.classList.toggle('storage-fill--warning', pct >= 80 && pct < 95);
        fillEl.classList.toggle('storage-fill--full', pct >= 95);
    }

    // ============================================
    // PREVIEW FILE
    // ============================================
    async function openPreview(id) {
        const record = allFiles.find((f) => f.id === id);
        if (!record) return;
        activeFileId = id;

        document.getElementById('previewTitle').textContent = record.original_name;
        document.getElementById('previewMeta').textContent =
            formatBytes(record.file_size) + ' \u00b7 diunggah ' + formatDate(record.created_at) + ' \u00b7 dienkripsi ChaCha20-Poly1305';

        const body = document.getElementById('previewBody');
        body.innerHTML = '<div class="decrypting-state"><div class="spinner spinner-dark"></div><span>Mendownload & mendekripsi file...</span></div>';

        const editBtn = document.getElementById('previewEditBtn');
        editBtn.style.display = isText(record.file_ext) ? 'flex' : 'none';

        openModal('previewModal');

        try {
            const result = await downloadFileFromServer(id);
            
            if (!result.success) {
                throw new Error(result.error || 'Download failed');
            }
            
            const nonce = ChaCha20Poly1305.base64ToBytes(record.nonce);
            const ciphertext = await result.blob.arrayBuffer();
            const cipherArray = new Uint8Array(ciphertext);
            
            const plain = decryptBuffer(cipherArray, nonce, record.original_name, ownerEmail);
            
            renderPreviewContent(body, record, plain);
            
        } catch (err) {
            console.error('❌ Preview error:', err);
            body.innerHTML = '<div class="preview-unavailable"><i class="fas fa-triangle-exclamation"></i><p>Gagal mendekripsi file: ' + err.message + '</p></div>';
        }
    }

    function renderPreviewContent(body, record, plainBytes) {
        const ext = record.file_ext;
        body.innerHTML = '';

        if (isImage(ext)) {
            const blob = new Blob([plainBytes], { type: record.mime_type || 'image/*' });
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            body.appendChild(img);
        } else if (isPdf(ext)) {
            const blob = new Blob([plainBytes], { type: 'application/pdf' });
            const iframe = document.createElement('iframe');
            iframe.src = URL.createObjectURL(blob);
            body.appendChild(iframe);
        } else if (isAudio(ext)) {
            const blob = new Blob([plainBytes], { type: record.mime_type || 'audio/*' });
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = URL.createObjectURL(blob);
            body.style.padding = '40px';
            body.appendChild(audio);
        } else if (isVideo(ext)) {
            const blob = new Blob([plainBytes], { type: record.mime_type || 'video/*' });
            const video = document.createElement('video');
            video.controls = true;
            video.src = URL.createObjectURL(blob);
            body.appendChild(video);
        } else if (isText(ext)) {
            const text = new TextDecoder().decode(plainBytes);
            const pre = document.createElement('pre');
            pre.textContent = text;
            body.appendChild(pre);
        } else {
            body.innerHTML = '<div class="preview-unavailable"><i class="fas fa-file-shield"></i><p>Pratinjau tidak tersedia untuk tipe file ini.<br>File sudah berhasil didekripsi &mdash; silakan unduh untuk membukanya.</p></div>';
        }
    }

    // ============================================
    // DOWNLOAD FILE
    // ============================================
    async function downloadFile(id) {
        const record = allFiles.find((f) => f.id === id);
        if (!record) return;
        
        try {
            showAlert('info', '📥 Mendownload & mendekripsi file...');
            
            const result = await downloadFileFromServer(id);
            
            if (!result.success) {
                throw new Error(result.error || 'Download failed');
            }
            
            const nonce = ChaCha20Poly1305.base64ToBytes(record.nonce);
            const ciphertext = await result.blob.arrayBuffer();
            const cipherArray = new Uint8Array(ciphertext);
            
            const plain = decryptBuffer(cipherArray, nonce, record.original_name, ownerEmail);
            
            const blob = new Blob([plain], { type: record.mime_type || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = record.original_name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 3000);

            showAlert('success', '✅ File berhasil didekripsi & diunduh: ' + record.original_name);
        } catch (err) {
            console.error('❌ Download error:', err);
            showAlert('danger', 'Gagal mendownload file: ' + err.message);
        }
    }

    // ============================================
    // RENAME FILE
    // ============================================
    function openRename(id) {
        const record = allFiles.find((f) => f.id === id);
        if (!record) return;
        activeFileId = id;
        document.getElementById('renameInput').value = record.original_name;
        document.getElementById('renameError').textContent = '';
        document.getElementById('renameInput').classList.remove('is-invalid');
        openModal('renameModal');
        setTimeout(() => document.getElementById('renameInput').focus(), 150);
    }

    async function saveRename() {
        const record = allFiles.find((f) => f.id === activeFileId);
        if (!record) return;

        const input = document.getElementById('renameInput');
        const errorEl = document.getElementById('renameError');
        const newName = input.value.trim();

        if (newName === '') {
            errorEl.textContent = '⚠️ Nama file tidak boleh kosong';
            input.classList.add('is-invalid');
            return;
        }

        try {
            const result = await renameFileOnServer(activeFileId, newName);
            
            if (result.success) {
                await refreshFiles();
                closeModal('renameModal');
                showAlert('success', '✅ Nama file berhasil diubah');
            } else {
                throw new Error(result.message || 'Rename failed');
            }
        } catch (err) {
            console.error('❌ Rename error:', err);
            errorEl.textContent = '⚠️ ' + err.message;
        }
    }

    // ============================================
    // DELETE FILE
    // ============================================
    function openDeleteConfirm(id) {
        const record = allFiles.find((f) => f.id === id);
        if (!record) return;
        activeFileId = id;
        document.getElementById('deleteFileName').textContent = record.original_name;
        openModal('deleteModal');
    }

    async function confirmDelete() {
        if (!activeFileId) return;
        
        try {
            const result = await deleteFileFromServer(activeFileId);
            
            if (result.success) {
                await refreshFiles();
                closeModal('deleteModal');
                showAlert('success', '✅ File berhasil dihapus');
            } else {
                throw new Error(result.message || 'Delete failed');
            }
        } catch (err) {
            console.error('❌ Delete error:', err);
            showAlert('danger', 'Gagal menghapus file: ' + err.message);
        }
    }

    // ============================================
    // EDIT FILE
    // ============================================
    function openEdit(id) {
        const record = allFiles.find((f) => f.id === id);
        if (!record) return;
        if (!isText(record.file_ext)) {
            showAlert('warning', 'Hanya file berbasis teks yang dapat diedit langsung.');
            return;
        }
        
        activeFileId = id;
        document.getElementById('editTitle').textContent = 'Edit \u2014 ' + record.original_name;

        showAlert('info', '📥 Memuat file untuk diedit...');
        
        downloadFileFromServer(id).then(async (result) => {
            if (!result.success) {
                showAlert('danger', 'Gagal memuat file: ' + result.error);
                return;
            }
            
            const nonce = ChaCha20Poly1305.base64ToBytes(record.nonce);
            const ciphertext = await result.blob.arrayBuffer();
            const cipherArray = new Uint8Array(ciphertext);
            
            try {
                const plain = decryptBuffer(cipherArray, nonce, record.original_name, ownerEmail);
                document.getElementById('editTextarea').value = new TextDecoder().decode(plain);
                openModal('editModal');
                showAlert('success', '✅ File siap diedit');
            } catch (err) {
                showAlert('danger', 'Gagal mendekripsi file: ' + err.message);
            }
        });
    }

    async function saveEdit() {
        const record = allFiles.find((f) => f.id === activeFileId);
        if (!record) return;

        const btn = document.getElementById('saveEditBtn');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner spinner-dark" style="width:14px;height:14px;border-width:2px;"></span> Menyimpan...';

        try {
            const newText = document.getElementById('editTextarea').value;
            const encoded = new TextEncoder().encode(newText);

            const { nonce, cipherWithTag } = await encryptBuffer(encoded.buffer, record.original_name, ownerEmail);
            
            const ciphertextBase64 = ChaCha20Poly1305.bytesToBase64(cipherWithTag);
            const nonceBase64 = ChaCha20Poly1305.bytesToBase64(nonce);
            
            const result = await editFileOnServer(activeFileId, ciphertextBase64, nonceBase64);
            
            if (result.success) {
                await refreshFiles();
                closeModal('editModal');
                showAlert('success', '✅ Perubahan disimpan & dienkripsi ulang.');
            } else {
                throw new Error(result.message || 'Edit failed');
            }
        } catch (err) {
            console.error('❌ Edit error:', err);
            showAlert('danger', 'Gagal menyimpan perubahan: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    // ============================================
    // MODAL HELPERS
    // ============================================
    function openModal(id) { document.getElementById(id).classList.add('open'); }
    function closeModal(id) { document.getElementById(id).classList.remove('open'); }

    // ============================================
    // ALERT
    // ============================================
function showAlert(type, message) {
    const container = document.getElementById('alertContainer');
    if (!container) return;
    
    const icons = {
        success: 'fa-check-circle',
        danger: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
        <button class="close">&times;</button>
    `;
    
    // Hapus alert lama
    container.querySelectorAll('.alert').forEach(el => {
        el.classList.add('hide');
        setTimeout(() => el.remove(), 300);
    });
    
    container.appendChild(alert);
    
    // Close button
    alert.querySelector('.close').addEventListener('click', () => {
        alert.classList.add('hide');
        setTimeout(() => alert.remove(), 300);
    });
    
    // Auto close 3 detik
    setTimeout(() => {
        if (alert.parentElement) {
            alert.classList.add('hide');
            setTimeout(() => alert.remove(), 300);
        }
    }, 3000);
}

    // ============================================
    // EVENT WIRING
    // ============================================
    function closeAllCardMenus() {
        document.querySelectorAll('.card-menu.open').forEach((m) => m.classList.remove('open'));
    }

    function closeSidebarMobile() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('show');
    }

    function initEvents() {
        console.log('🔧 Initializing events...');
        
        const fileInput = document.getElementById('fileInput');
        const btnUpload = document.getElementById('btnUpload');
        const btnUploadEmpty = document.getElementById('btnUploadEmpty');
        
        if (btnUpload) {
            btnUpload.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('📤 Upload button clicked');
                if (fileInput) fileInput.click();
            });
        }
        
        if (btnUploadEmpty) {
            btnUploadEmpty.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('📤 Upload empty button clicked');
                if (fileInput) fileInput.click();
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                console.log('📎 Files selected:', e.target.files.length);
                if (e.target.files.length > 0) {
                    handleFiles(e.target.files);
                }
                fileInput.value = '';
            });
        }

        const dropzone = document.getElementById('dropzone');
        if (dropzone) {
            ['dragenter', 'dragover'].forEach((evt) => {
                dropzone.addEventListener(evt, function(e) {
                    e.preventDefault();
                    dropzone.classList.add('drag-over');
                });
            });
            ['dragleave', 'drop'].forEach((evt) => {
                dropzone.addEventListener(evt, function(e) {
                    e.preventDefault();
                    dropzone.classList.remove('drag-over');
                });
            });
            dropzone.addEventListener('drop', function(e) {
                e.preventDefault();
                if (e.dataTransfer.files.length) {
                    console.log('📎 Files dropped:', e.dataTransfer.files.length);
                    handleFiles(e.dataTransfer.files);
                }
            });
            dropzone.addEventListener('click', function() {
                if (fileInput) fileInput.click();
            });
        }

        document.querySelectorAll('.nav-item').forEach((item) => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔍 Filter clicked:', this.dataset.filter);
                
                document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
                this.classList.add('active');
                
                currentFilter = this.dataset.filter;
                const titles = { all: 'Semua File', image: 'Gambar', document: 'Dokumen', other: 'Lainnya' };
                const titleEl = document.getElementById('contentTitle');
                if (titleEl) titleEl.textContent = titles[currentFilter] || 'Semua File';
                
                renderGrid();
                closeSidebarMobile();
            });
        });

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                searchTerm = e.target.value;
                renderGrid();
            });
        }

        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', function(e) {
                currentSort = e.target.value;
                renderGrid();
            });
        }

        const btnMenu = document.getElementById('btnMenu');
        if (btnMenu) {
            btnMenu.addEventListener('click', function() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (sidebar) sidebar.classList.add('open');
                if (overlay) overlay.classList.add('show');
            });
        }
        
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) {
            overlay.addEventListener('click', closeSidebarMobile);
        }

        const userTrigger = document.getElementById('userTrigger');
        const userDropdown = document.getElementById('userDropdown');
        if (userTrigger && userDropdown) {
            userTrigger.addEventListener('click', function(e) {
                e.stopPropagation();
                userDropdown.classList.toggle('open');
            });
            document.addEventListener('click', function() {
                userDropdown.classList.remove('open');
            });
        }

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('👋 Logging out...');
        
        fetch(`${API_BASE_URL}/accounts/logout/`, {
            method: 'GET', 
            credentials: 'include',
        })
        .finally(() => {
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('pre2faUser');
            sessionStorage.removeItem('pendingRegistration');
            localStorage.removeItem('rememberedEmail');
            window.location.href = '/login/';
        });
    });
}

        const fileGrid = document.getElementById('fileGrid');
        if (fileGrid) {
            fileGrid.addEventListener('click', function(e) {
                const card = e.target.closest('.file-card');
                if (!card) return;
                const id = card.dataset.id;

                const menuBtn = e.target.closest('.card-menu-btn');
                if (menuBtn) {
                    e.stopPropagation();
                    document.querySelectorAll('.card-menu.open').forEach((m) => {
                        if (m !== menuBtn.nextElementSibling) m.classList.remove('open');
                    });
                    const menu = menuBtn.nextElementSibling;
                    if (menu) menu.classList.toggle('open');
                    return;
                }

                const actionBtn = e.target.closest('[data-action]');
                if (actionBtn) {
                    e.stopPropagation();
                    closeAllCardMenus();
                    const action = actionBtn.dataset.action;
                    if (action === 'preview') openPreview(id);
                    else if (action === 'download') downloadFile(id);
                    else if (action === 'edit') openEdit(id);
                    else if (action === 'rename') openRename(id);
                    else if (action === 'delete') openDeleteConfirm(id);
                    return;
                }

                if (e.target.closest('.file-cover') || e.target.closest('.file-info')) {
                    openPreview(id);
                }
            });
        }

        document.addEventListener('click', closeAllCardMenus);

        const previewDownloadBtn = document.getElementById('previewDownloadBtn');
        if (previewDownloadBtn) {
            previewDownloadBtn.addEventListener('click', function() {
                if (activeFileId) downloadFile(activeFileId);
            });
        }
        
        const previewEditBtn = document.getElementById('previewEditBtn');
        if (previewEditBtn) {
            previewEditBtn.addEventListener('click', function() {
                closeModal('previewModal');
                if (activeFileId) openEdit(activeFileId);
            });
        }
        
        const saveEditBtn = document.getElementById('saveEditBtn');
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', saveEdit);
        }
        
        const saveRenameBtn = document.getElementById('saveRenameBtn');
        if (saveRenameBtn) {
            saveRenameBtn.addEventListener('click', saveRename);
        }
        
        const renameInput = document.getElementById('renameInput');
        if (renameInput) {
            renameInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') saveRename();
            });
        }
        
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', confirmDelete);
        }

        document.querySelectorAll('[data-close]').forEach((btn) => {
            btn.addEventListener('click', function() {
                const modalId = this.dataset.close;
                if (modalId) closeModal(modalId);
            });
        });
        
        document.querySelectorAll('.modal-overlay').forEach((overlay) => {
            overlay.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('open');
                }
            });
        });

        console.log('✅ Events initialized');
    }

    // ============================================
    // INIT USER UI
    // ============================================
    function initUserUi() {
        try {
            const label = currentUser.email || 'Pengguna';
            const initial = label.charAt(0).toUpperCase();
            
            const elements = {
                userAvatar: document.getElementById('userAvatar'),
                userAvatarBig: document.getElementById('userAvatarBig'),
                userNameLabel: document.getElementById('userNameLabel'),
                dropdownName: document.getElementById('dropdownName'),
                dropdownEmail: document.getElementById('dropdownEmail')
            };
            
            if (elements.userAvatar) elements.userAvatar.textContent = initial;
            if (elements.userAvatarBig) elements.userAvatarBig.textContent = initial;
            if (elements.userNameLabel) elements.userNameLabel.textContent = label.split('@')[0];
            if (elements.dropdownName) elements.dropdownName.textContent = label.split('@')[0];
            if (elements.dropdownEmail) elements.dropdownEmail.textContent = label;
            
            console.log('✅ User UI initialized');
        } catch (err) {
            console.error('❌ Failed to init user UI:', err);
        }
    }

    // ============================================
    // INIT
    // ============================================
    async function init() {
        console.log('🚀 Initializing dashboard...');
        
        // CEK SESSION TAPI JANGAN LANGSUNG REDIRECT
        let sessionValid = false;
        
        try {
            const sessionCheck = await fetch(`${API_BASE_URL}/accounts/current-user/`, {
                method: 'GET',
                credentials: 'include',
            });
            
            console.log('📡 Session check status:', sessionCheck.status);
            
            if (sessionCheck.ok) {
                const sessionData = await sessionCheck.json();
                console.log('✅ Session valid:', sessionData);
                sessionValid = true;
            } else {
                console.warn('⚠️ Session check failed with status:', sessionCheck.status);
            }
        } catch (err) {
            console.warn('⚠️ Session check error:', err);
        }
        
        // Jika session tidak valid tapi user ada di sessionStorage, lanjutkan
        if (!sessionValid) {
            if (currentUserRaw) {
                console.warn('⚠️ Session API error tapi user ada di sessionStorage, lanjutkan...');
            } else {
                console.error('❌ No user in sessionStorage, redirecting to login');
                window.location.href = '/login/';
                return;
            }
        }
        
        if (typeof ChaCha20Poly1305 === 'undefined') {
            showAlert('danger', 'Library enkripsi tidak ditemukan. Silakan refresh halaman.');
            return;
        }
        
        initUserUi();
        initEvents();
        await refreshFiles();
        
        console.log('✅ Dashboard ready');
    }

    // ============================================
    // START - PASTIKAN INI ADA
    // ============================================
    document.addEventListener('DOMContentLoaded', init);

})();  // ← TUTUP IIFE
