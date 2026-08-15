/**
 * TOTP.JS - Terintegrasi dengan Backend Django
 */

const API_BASE_URL = window.location.origin + '/api';

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Halaman TOTP siap!');
    console.log('📍 Current URL:', window.location.pathname);
    
    // Cek apakah ini halaman setup (registrasi) atau verify (login)
    const isSetupPage = document.getElementById('totpForm') !== null;
    const isVerifyPage = document.getElementById('totpVerifyForm') !== null;
    
    console.log('📄 Is Setup Page:', isSetupPage);
    console.log('📄 Is Verify Page:', isVerifyPage);
    
    if (isSetupPage) {
        // Halaman setup TOTP (setelah registrasi)
        const pendingData = JSON.parse(sessionStorage.getItem('pendingRegistration') || 'null');
        console.log('📦 Pending registration data:', pendingData);
        
        if (pendingData) {
            displayQRCode(pendingData.qr_code);
            const secretEl = document.getElementById('secretKey');
            if (secretEl) {
                secretEl.textContent = pendingData.totp_secret;
            }
            console.log('📱 Data dari registrasi:', pendingData);
        } else {
            console.warn('⚠️ Tidak ada data registrasi ditemukan');
        }
        
        // Setup form submit untuk setup
        const form = document.getElementById('totpForm');
        if (form) {
            form.addEventListener('submit', handleTOTPSetup);
        }
    }
    
    if (isVerifyPage) {
        // Halaman verify TOTP (setelah login dengan 2FA)
        console.log('🔐 Initializing verify page');
        initVerifyPage();
    }
});

function displayQRCode(qrCodeBase64) {
    const qrImg = document.getElementById('qrCodeImg');
    const placeholder = document.getElementById('qrPlaceholder');
    
    if (qrCodeBase64) {
        qrImg.src = qrCodeBase64;
        qrImg.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        console.log('✅ QR Code dimuat dari backend');
    } else {
        if (placeholder) {
            placeholder.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>QR Code tidak tersedia</span>';
        }
    }
}

function handleTOTPSetup(event) {
    event.preventDefault();
    console.log('🔐 Proses setup TOTP dimulai...');
    
    const token = document.getElementById('totpToken').value.trim();
    const errorEl = document.getElementById('totpError');
    
    // Clear previous errors
    errorEl.textContent = '';
    document.getElementById('totpToken').classList.remove('is-invalid');
    
    // Validate token
    if (token.length !== 6 || !/^\d{6}$/.test(token)) {
        errorEl.textContent = '⚠️ Masukkan kode 6 digit yang valid';
        document.getElementById('totpToken').classList.add('is-invalid');
        return;
    }
    
    // Get pending data
    const pendingData = JSON.parse(sessionStorage.getItem('pendingRegistration') || 'null');
    console.log('📦 Pending data for setup:', pendingData);
    
    if (!pendingData || !pendingData.email) {
        showAlert('danger', '❌ Data registrasi tidak ditemukan. Silakan registrasi ulang.');
        return;
    }
    
    showLoading(true);
    
    // Kirim request ke backend
    fetch(`${API_BASE_URL}/accounts/verify-totp/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            email: pendingData.email,  // Kirim email
            totp_code: token
        })
    })
    .then(async response => {
        const text = await response.text();
        console.log('📥 Raw response:', text);
        try {
            const data = JSON.parse(text);
            return { response, data };
        } catch (e) {
            console.error('❌ Failed to parse JSON:', e);
            throw new Error('Invalid JSON response');
        }
    })
    .then(({ response, data }) => {
        showLoading(false);
        console.log('📦 Response data:', data);
        
        if (data.success) {
            showAlert('success', '✅ ' + data.message);
            sessionStorage.setItem('currentUser', JSON.stringify(data.data));
            sessionStorage.removeItem('pendingRegistration');
            
            // Redirect ke dashboard
            setTimeout(function() {
                console.log('🚀 Redirecting to dashboard...');
                window.location.href = '/dashboard/';
            }, 1500);
        } else {
            showAlert('danger', '❌ ' + data.message);
            errorEl.textContent = '⚠️ ' + data.message;
            document.getElementById('totpToken').classList.add('is-invalid');
            
            // Shake animation
            const box = document.querySelector('.totp-box');
            if (box) {
                box.style.animation = 'shake 0.5s ease';
                setTimeout(function() { box.style.animation = ''; }, 500);
            }
        }
    })
    .catch(error => {
        showLoading(false);
        console.error('❌ Error:', error);
        showAlert('danger', '❌ Gagal terhubung ke server. Error: ' + error.message);
    });
}

function initVerifyPage() {
    console.log('🔐 Initializing TOTP verify page');
    
    // Start timer
    startTimer();
    
    // Focus input
    const tokenInput = document.getElementById('totpTokenVerify');
    if (tokenInput) {
        tokenInput.focus();
        console.log('✅ Input focused');
    }
    
    // Tampilkan email user
    const userData = JSON.parse(sessionStorage.getItem('pre2faUser') || 'null');
    console.log('📦 Pre-2FA user data:', userData);
    
    const userEmail = document.getElementById('userEmail');
    if (userEmail && userData) {
        // Tampilkan email (bisa dari data.email atau data.username)
        const displayEmail = userData.email || userData.username;
        userEmail.textContent = displayEmail;
        console.log('✅ Displaying email:', displayEmail);
    }
    
    // Setup form submit untuk verify
    const form = document.getElementById('totpVerifyForm');
    if (form) {
        console.log('✅ Form found, attaching submit handler');
        // Hapus event listener yang mungkin sudah ada
        form.removeEventListener('submit', handleTOTPVerify);
        form.addEventListener('submit', handleTOTPVerify);
    } else {
        console.error('❌ Form with id "totpVerifyForm" not found!');
    }
}

function handleTOTPVerify(event) {
    event.preventDefault();
    console.log('🔐 Proses verifikasi TOTP dimulai...');
    
    const tokenInput = document.getElementById('totpTokenVerify');
    const token = tokenInput ? tokenInput.value.trim() : '';
    const errorEl = document.getElementById('totpVerifyError');
    
    console.log('📝 Token input:', token);
    
    // Clear errors
    if (errorEl) errorEl.textContent = '';
    if (tokenInput) tokenInput.classList.remove('is-invalid');
    
    // Validate token
    if (token.length !== 6 || !/^\d{6}$/.test(token)) {
        const msg = '⚠️ Masukkan kode 6 digit yang valid';
        if (errorEl) errorEl.textContent = msg;
        if (tokenInput) tokenInput.classList.add('is-invalid');
        return;
    }
    
    // Get user data from session
    const pre2faUser = JSON.parse(sessionStorage.getItem('pre2faUser') || 'null');
    console.log('📦 Pre-2FA user data:', pre2faUser);
    
    if (!pre2faUser) {
        showAlert('danger', '❌ Sesi login tidak ditemukan. Silakan login ulang.');
        return;
    }
    
    showLoading(true);
    
    // Kirim request ke backend untuk verifikasi TOTP
    fetch(`${API_BASE_URL}/accounts/login/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            email: pre2faUser.email || pre2faUser.username,
            password: pre2faUser.password,
            totp_code: token
        })
    })
    .then(async response => {
        const text = await response.text();
        console.log('📥 Raw response:', text);
        try {
            const data = JSON.parse(text);
            return { response, data };
        } catch (e) {
            console.error('❌ Failed to parse JSON:', e);
            throw new Error('Invalid JSON response');
        }
    })
    .then(({ response, data }) => {
        showLoading(false);
        console.log('📦 Response data:', data);
        
        if (data.success) {
            // 🔥 IMPORTANT: Save user data to sessionStorage
            console.log('✅ Login successful, saving user data...');
            
            // Simpan data user dari response
            if (data.data) {
                sessionStorage.setItem('currentUser', JSON.stringify(data.data));
                console.log('📦 Saved currentUser:', data.data);
            } else {
                // Fallback: buat data user dari email
                sessionStorage.setItem('currentUser', JSON.stringify({
                    email: pre2faUser.email || pre2faUser.username,
                    username: pre2faUser.email || pre2faUser.username
                }));
                console.log('📦 Saved fallback user data');
            }
            
            // Clear pre2fa data
            sessionStorage.removeItem('pre2faUser');
            
            showAlert('success', '✅ ' + data.message);
            
            // Redirect ke dashboard dengan delay
            setTimeout(function() {
                console.log('🚀 Redirecting to dashboard...');
                window.location.href = '/dashboard/';
            }, 1000);
        } else {
            // Login failed
            let errorMsg = data.message || 'Verifikasi gagal';
            console.log('❌ Login failed:', errorMsg);
            showAlert('danger', '❌ ' + errorMsg);
            if (errorEl) {
                errorEl.textContent = '⚠️ ' + errorMsg;
            }
            if (tokenInput) {
                tokenInput.classList.add('is-invalid');
            }
        }
    })
    .catch(error => {
        showLoading(false);
        console.error('❌ Error:', error);
        showAlert('danger', '❌ Gagal terhubung ke server. Error: ' + error.message);
    });
}

function copySecret() {
    const secret = document.getElementById('secretKey').textContent;
    navigator.clipboard.writeText(secret).then(function() {
        showAlert('success', '✅ Kode rahasia disalin!');
    }).catch(function() {
        const input = document.createElement('input');
        input.value = secret;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showAlert('success', '✅ Kode rahasia disalin!');
    });
}

function showLoading(show) {
    // Coba untuk setup page
    const btnSetup = document.getElementById('totpBtn');
    if (btnSetup) {
        const btnText = document.getElementById('btnText');
        const btnContent = document.getElementById('btnContent');
        const spinner = document.getElementById('btnSpinner');
        
        btnSetup.disabled = show;
        if (btnText) btnText.textContent = show ? 'Memverifikasi...' : 'Verifikasi & Aktifkan';
        if (btnContent) btnContent.style.display = show ? 'none' : 'flex';
        if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
    }
    
    // Coba untuk verify page
    const btnVerify = document.getElementById('totpVerifyBtn');
    if (btnVerify) {
        const btnText = document.getElementById('btnText');
        const btnContent = document.getElementById('btnContent');
        const spinner = document.getElementById('btnSpinner');
        
        btnVerify.disabled = show;
        if (btnText) btnText.textContent = show ? 'Memverifikasi...' : 'Verifikasi';
        if (btnContent) btnContent.style.display = show ? 'none' : 'flex';
        if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
    }
}

let timerInterval = null;
let timeLeft = 30;

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 30;
    updateTimerDisplay();
    
    timerInterval = setInterval(function() {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Reset timer after 1 second
            setTimeout(function() {
                timeLeft = 30;
                updateTimerDisplay();
                startTimer();
            }, 1000);
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerText = document.getElementById('timerText');
    const progress = document.getElementById('timerProgress');
    
    if (timerText) {
        timerText.textContent = timeLeft;
        timerText.style.color = timeLeft <= 5 ? '#EF4444' : '';
    }
    
    if (progress) {
        const circumference = 2 * Math.PI * 45;
        const offset = circumference - (timeLeft / 30) * circumference;
        progress.style.strokeDasharray = circumference;
        progress.style.strokeDashoffset = offset;
        progress.style.stroke = timeLeft <= 5 ? '#EF4444' : '#2563EB';
    }
}

function showAlert(type, message) {
    const container = document.getElementById('alertContainer');
    if (!container) {
        console.warn('⚠️ Alert container not found');
        return;
    }
    
    const icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };
    const alert = document.createElement('div');
    alert.className = 'alert alert-' + type;
    alert.innerHTML = `
        <span class="alert-icon">${icons[type] || 'ℹ️'}</span>
        <span>${message}</span>
        <button class="alert-close" onclick="this.parentElement.remove()">✕</button>
    `;
    
    container.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(function() {
        if (alert.parentElement) {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            alert.style.transition = 'all 0.3s ease';
            setTimeout(function() {
                if (alert.parentElement) alert.remove();
            }, 300);
        }
    }, 5000);
}
