/**
 * LOGIN.JS - Terintegrasi dengan Backend Django
 */

const API_BASE_URL = window.location.origin + '/api';

// 🔥 FUNGSI AMBIL CSRF TOKEN
function getCSRFToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='));
    return cookieValue ? cookieValue.split('=')[1] : '';
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Halaman login siap!');
    
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePassword');
    
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
    
    checkRememberedUser();
    
    if (emailInput) {
        emailInput.addEventListener('keydown', handleEnterKey);
    }
    if (passwordInput) {
        passwordInput.addEventListener('keydown', handleEnterKey);
    }

    setupForgotPasswordModal();
});

// 🔥 MODAL LUPA PASSWORD
function setupForgotPasswordModal() {
    const forgotLink = document.getElementById('forgotLink');
    const modal = document.getElementById('forgotModal');
    const emailInput = document.getElementById('forgotEmail');
    const errorEl = document.getElementById('forgotEmailError');
    const submitBtn = document.getElementById('forgotSubmitBtn');

    if (!forgotLink || !modal) return;

    const openModal = () => {
        modal.classList.add('show');
        if (emailInput) {
            emailInput.value = '';
            emailInput.classList.remove('is-invalid');
            setTimeout(() => emailInput.focus(), 50);
        }
        if (errorEl) errorEl.textContent = '';
    };

    const closeModal = () => modal.classList.remove('show');

    forgotLink.addEventListener('click', function (event) {
        event.preventDefault();
        openModal();
    });

    // Tombol close & backdrop (data-close="forgotModal")
    modal.querySelectorAll('[data-close="forgotModal"]').forEach((el) => {
        el.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', function (event) {
        if (event.target === modal) closeModal();
    });

    const submitForgotPassword = function () {
        const email = emailInput ? emailInput.value.trim() : '';

        if (errorEl) errorEl.textContent = '';
        if (emailInput) emailInput.classList.remove('is-invalid');

        if (!email || !isValidEmail(email)) {
            if (emailInput) emailInput.classList.add('is-invalid');
            if (errorEl) errorEl.textContent = '⚠️ Masukkan email yang valid';
            return;
        }

        setForgotLoading(true);

        const csrfToken = getCSRFToken();

        fetch(`${API_BASE_URL}/accounts/forgot-password/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            credentials: 'include',
            body: JSON.stringify({ email }),
        })
        .then(async (response) => {
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error('Invalid JSON response');
            }
        })
        .then((data) => {
            setForgotLoading(false);
            if (data.success) {
                closeModal();
                showAlert('success', '✅ ' + data.message);
            } else {
                showAlert('danger', '❌ ' + (data.message || 'Gagal mengirim link reset'));
            }
        })
        .catch((error) => {
            setForgotLoading(false);
            console.error('❌ Forgot password error:', error);
            showAlert('danger', '❌ Gagal terhubung ke server. Coba lagi.');
        });
    };

    if (submitBtn) {
        submitBtn.addEventListener('click', submitForgotPassword);
    }
    if (emailInput) {
        emailInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitForgotPassword();
            }
        });
    }
}

function setForgotLoading(show) {
    const btn = document.getElementById('forgotSubmitBtn');
    const btnText = document.getElementById('forgotBtnText');
    const spinner = document.getElementById('forgotBtnSpinner');

    if (btn) btn.disabled = show;
    if (btnText) btnText.style.display = show ? 'none' : 'inline-flex';
    if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
}

function handleLogin(event) {
    event.preventDefault();
    
    console.log('🔐 Proses login dimulai...');
    
    const emailElement = document.getElementById('email');
    const passwordElement = document.getElementById('password');
    const rememberMeElement = document.getElementById('rememberMe');
    
    const email = emailElement ? emailElement.value.trim() : '';
    const password = passwordElement ? passwordElement.value.trim() : '';
    const rememberMe = rememberMeElement ? rememberMeElement.checked : false;
    
    clearErrors();
    
    let isValid = true;
    if (!email) {
        showFieldError('email', 'Email tidak boleh kosong');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showFieldError('email', 'Format email tidak valid');
        isValid = false;
    }
    
    if (!password) {
        showFieldError('password', 'Password tidak boleh kosong');
        isValid = false;
    } else if (password.length < 8) {
        showFieldError('password', 'Password minimal 8 karakter');
        isValid = false;
    }
    
    if (!isValid) return;
    
    showLoading(true);
    
    // 🔥 AMBIL CSRF TOKEN
    const csrfToken = getCSRFToken();
    
    fetch(`${API_BASE_URL}/accounts/login/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
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
        
        // 🔥 CEK require_totp DULUAN
        if (data.require_totp) {
            console.log('🔐 TOTP required, redirecting...');
            sessionStorage.setItem('pre2faUser', JSON.stringify({
                email: data.email || email,
                password: password
            }));
            window.location.href = '/totp-verify/';
            return;
        }
        
        if (data.success) {
            console.log('✅ Login successful, saving user data...');
            if (data.data) {
                sessionStorage.setItem('currentUser', JSON.stringify(data.data));
            } else {
                sessionStorage.setItem('currentUser', JSON.stringify({
                    email: email,
                    username: email.split('@')[0]
                }));
            }
            
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }
            
            showAlert('success', '✅ Login berhasil!');
            setTimeout(function() {
                window.location.href = '/dashboard/';
            }, 1000);
        } else {
            let errorMsg = data.message || 'Login gagal';
            if (data.errors) {
                const errors = Object.values(data.errors).flat();
                if (errors.length > 0) {
                    errorMsg = errors[0];
                }
            }
            showAlert('danger', '❌ ' + errorMsg);
            showFieldError('password', errorMsg);
        }
    })
    .catch(error => {
        showLoading(false);
        console.error('❌ Error:', error);
        showAlert('danger', '❌ Gagal terhubung ke server. Error: ' + error.message);
    });
}

// 🔥 FUNGSI TOTP VERIFY (untuk halaman totp-verify.html)
function handleTOTPVerify(event) {
    event.preventDefault();
    
    const tokenInput = document.getElementById('totpTokenVerify');
    const token = tokenInput ? tokenInput.value.trim() : '';
    
    if (token.length !== 6 || !/^\d{6}$/.test(token)) {
        showFieldError('totp', 'Masukkan kode 6 digit yang valid');
        return;
    }
    
    const pre2faUser = JSON.parse(sessionStorage.getItem('pre2faUser') || 'null');
    if (!pre2faUser) {
        showAlert('danger', '❌ Sesi login tidak ditemukan');
        return;
    }
    
    showLoading(true);
    
    const csrfToken = getCSRFToken();
    
    fetch(`${API_BASE_URL}/accounts/login/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
            email: pre2faUser.email,
            password: pre2faUser.password,
            totp_code: token
        })
    })
    .then(async response => {
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            return { response, data };
        } catch (e) {
            throw new Error('Invalid JSON response');
        }
    })
    .then(({ response, data }) => {
        showLoading(false);
        
        if (data.success) {
            showAlert('success', '✅ ' + data.message);
            sessionStorage.removeItem('pre2faUser');
            if (data.data) {
                sessionStorage.setItem('currentUser', JSON.stringify(data.data));
            }
            setTimeout(function() {
                window.location.href = '/dashboard/';
            }, 1000);
        } else {
            let errorMsg = data.message || 'Verifikasi gagal';
            showAlert('danger', '❌ ' + errorMsg);
            showFieldError('totp', errorMsg);
        }
    })
    .catch(error => {
        showLoading(false);
        console.error('Error:', error);
        showAlert('danger', '❌ Gagal terhubung ke server');
    });
}

// Helper functions (tetap sama seperti sebelumnya)
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showLoading(show) {
    const btn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    const btnContent = document.getElementById('btnContent');
    const spinner = document.getElementById('btnSpinner');
    
    if (btn) btn.disabled = show;
    if (btnText) btnText.textContent = show ? 'Memproses...' : 'Masuk';
    if (btnContent) btnContent.style.display = show ? 'none' : 'flex';
    if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
}

function showFieldError(field, message) {
    const fieldMap = {
        'email': 'email',
        'password': 'password',
        'totp': 'totpTokenVerify'
    };
    
    const fieldId = fieldMap[field];
    if (!fieldId) return;
    
    const input = document.getElementById(fieldId);
    if (input) {
        input.classList.add('is-invalid');
        const parent = input.closest('.form-group');
        if (parent) {
            const errorDiv = parent.querySelector('.form-error');
            if (errorDiv) {
                errorDiv.textContent = '⚠️ ' + message;
            }
        }
    }
}

function clearErrors() {
    document.querySelectorAll('.is-invalid').forEach(el => {
        el.classList.remove('is-invalid');
    });
    document.querySelectorAll('.form-error').forEach(el => {
        el.textContent = '';
    });
}

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

function checkRememberedUser() {
    const emailElement = document.getElementById('email');
    const rememberMeElement = document.getElementById('rememberMe');
    
    if (emailElement && rememberMeElement) {
        const remembered = localStorage.getItem('rememberedEmail');
        if (remembered) {
            emailElement.value = remembered;
            rememberMeElement.checked = true;
            console.log('✅ Remembered user loaded:', remembered);
        }
    }
}

function handleEnterKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const form = document.getElementById('loginForm');
        if (form) {
            form.dispatchEvent(new Event('submit'));
        }
    }
}
