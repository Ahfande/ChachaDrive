/**
 * RESET-PASSWORD.JS - Halaman set password baru setelah klik link dari email
 */

const API_BASE_URL = window.location.origin + '/api';

function getCSRFToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='));
    return cookieValue ? cookieValue.split('=')[1] : '';
}

function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('token') || '').trim();
}

document.addEventListener('DOMContentLoaded', function () {
    const token = getTokenFromUrl();
    const form = document.getElementById('resetForm');
    const invalidState = document.getElementById('invalidTokenState');

    // Kalau tidak ada token di URL, langsung tampilkan state "link tidak valid"
    // tanpa perlu request ke server dulu.
    if (!token) {
        if (form) form.style.display = 'none';
        if (invalidState) invalidState.style.display = 'block';
        return;
    }

    setupTogglePassword();

    if (form) {
        form.addEventListener('submit', function (event) {
            handleResetPassword(event, token);
        });
    }
});

function setupTogglePassword() {
    const toggleBtn = document.getElementById('toggleNewPassword');
    const passwordInput = document.getElementById('newPassword');

    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
}

function handleResetPassword(event, token) {
    event.preventDefault();

    const newPasswordEl = document.getElementById('newPassword');
    const confirmPasswordEl = document.getElementById('confirmPassword');

    const newPassword = newPasswordEl ? newPasswordEl.value : '';
    const confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : '';

    clearErrors();

    let isValid = true;
    if (!newPassword || newPassword.length < 8) {
        showFieldError('newPasswordError', 'newPassword', 'Password minimal 8 karakter');
        isValid = false;
    }
    if (newPassword !== confirmPassword) {
        showFieldError('confirmPasswordError', 'confirmPassword', 'Konfirmasi password tidak cocok');
        isValid = false;
    }

    if (!isValid) return;

    showLoading(true);

    const csrfToken = getCSRFToken();

    fetch(`${API_BASE_URL}/accounts/reset-password/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
            token: token,
            new_password: newPassword,
            new_password_confirm: confirmPassword,
        }),
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
        showLoading(false);

        if (data.success) {
            showAlert('success', '✅ ' + data.message);
            const form = document.getElementById('resetForm');
            const invalidState = document.getElementById('invalidTokenState');
            if (form) form.style.display = 'none';
            setTimeout(function () {
                window.location.href = '/login/';
            }, 1800);
        } else {
            showAlert('danger', '❌ ' + (data.message || 'Gagal mereset password'));

            // Kalau token sudah tidak valid/kedaluwarsa, tampilkan state itu juga
            if ((data.message || '').toLowerCase().includes('kedaluwarsa') ||
                (data.message || '').toLowerCase().includes('tidak valid')) {
                const form = document.getElementById('resetForm');
                const invalidState = document.getElementById('invalidTokenState');
                if (form) form.style.display = 'none';
                if (invalidState) invalidState.style.display = 'block';
            }
        }
    })
    .catch((error) => {
        showLoading(false);
        console.error('❌ Reset password error:', error);
        showAlert('danger', '❌ Gagal terhubung ke server. Coba lagi.');
    });
}

function showLoading(show) {
    const btn = document.getElementById('resetBtn');
    const btnText = document.getElementById('btnText');
    const btnContent = document.getElementById('btnContent');
    const spinner = document.getElementById('btnSpinner');

    if (btn) btn.disabled = show;
    if (btnText) btnText.textContent = show ? 'Menyimpan...' : 'Simpan Password Baru';
    if (btnContent) btnContent.style.display = show ? 'none' : 'flex';
    if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
}

function showFieldError(errorId, inputId, message) {
    const input = document.getElementById(inputId);
    const errorEl = document.getElementById(errorId);
    if (input) input.classList.add('is-invalid');
    if (errorEl) errorEl.textContent = '⚠️ ' + message;
}

function clearErrors() {
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
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