/**
 * REGISTER.JS - Terintegrasi dengan Backend Django
 */

const API_BASE_URL = window.location.origin + '/api';

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Halaman register siap!');
    
    // Toggle Password
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('id_password1');
    
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
    
    // Password strength
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value);
        });
    }
    
    // Form submit
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('id_username').value.trim();
    const email = document.getElementById('id_email').value.trim();
    const password = document.getElementById('id_password1').value;
    const passwordConfirm = document.getElementById('id_password2').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // Clear errors
    clearErrors();
    
    // Validate
    let isValid = true;
    
    if (!username || username.length < 3) {
        showFieldError('username', 'Username minimal 3 karakter');
        isValid = false;
    }
    
    if (!email || !isValidEmail(email)) {
        showFieldError('email', 'Masukkan email yang valid');
        isValid = false;
    }
    
    if (!password || password.length < 8) {
        showFieldError('password', 'Password minimal 8 karakter');
        isValid = false;
    }
    
    if (password !== passwordConfirm) {
        showFieldError('password_confirm', 'Password tidak cocok');
        isValid = false;
    }
    
    if (!agreeTerms) {
        showAlert('warning', '⚠️ Anda harus menyetujui Syarat & Ketentuan');
        isValid = false;
    }
    
    if (!isValid) return;
    
    // Show loading
    showLoading(true);
    
    // Send registration request
    fetch(`${API_BASE_URL}/accounts/register/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: username,
            email: email,
            password: password,
            password_confirm: passwordConfirm
        })
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        
        if (data.success) {
            showAlert('success', '✅ ' + data.message);
            
            sessionStorage.setItem('pendingRegistration', JSON.stringify({
                username: data.data.username,
                email: data.data.email,
                totp_secret: data.data.totp_secret,
                qr_code: data.data.qr_code
            }));
            
            setTimeout(function() {
                window.location.href = '/totp-setup/';
            }, 1500);
        } else {
            showAlert('danger', '❌ ' + data.message);
            
            if (data.errors) {
                for (const [field, message] of Object.entries(data.errors)) {
                    if (Array.isArray(message)) {
                        showFieldError(field, message[0]);
                    } else {
                        showFieldError(field, message);
                    }
                }
            }
        }
    })
    .catch(error => {
        showLoading(false);
        console.error('Error:', error);
        showAlert('danger', '❌ Gagal terhubung ke server. Pastikan backend berjalan.');
    });
}

function checkPasswordStrength(password) {
    const strengthContainer = document.getElementById('passwordStrength');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (password.length === 0) {
        strengthContainer.style.display = 'none';
        return;
    }
    
    strengthContainer.style.display = 'block';
    
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    
    let label, color, width;
    if (score <= 2) { label = 'Lemah'; color = '#EF4444'; width = '25%'; }
    else if (score <= 3) { label = 'Sedang'; color = '#F59E0B'; width = '50%'; }
    else if (score <= 4) { label = 'Kuat'; color = '#3B82F6'; width = '75%'; }
    else { label = 'Sangat Kuat'; color = '#10B981'; width = '100%'; }
    
    strengthFill.style.background = color;
    strengthFill.style.width = width;
    strengthText.textContent = 'Kekuatan: ' + label;
    strengthText.style.color = color;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(field, message) {
    const fieldMap = {
        'username': 'id_username',
        'email': 'id_email',
        'password': 'id_password1',
        'password_confirm': 'id_password2'
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

function showLoading(show) {
    const btn = document.getElementById('registerBtn');
    const btnText = document.getElementById('btnText');
    const btnContent = document.getElementById('btnContent');
    const spinner = document.getElementById('btnSpinner');
    
    if (btn) btn.disabled = show;
    if (btnText) btnText.textContent = show ? 'Mendaftar...' : 'Daftar';
    if (btnContent) btnContent.style.display = show ? 'none' : 'flex';
    if (spinner) spinner.style.display = show ? 'inline-block' : 'none';
}

function showAlert(type, message) {
    const container = document.getElementById('alertContainer');
    if (!container) return;
    
    const icons = { success: '✅', danger: '❌', warning: '⚠️', info: 'ℹ️' };
    const alert = document.createElement('div');
    alert.className = 'alert alert-' + type;
    alert.innerHTML = `
        <span class="alert-icon">${icons[type] || 'ℹ️'}</span>
        <span>${message}</span>
        <button class="alert-close" onclick="this.parentElement.remove()">✕</button>
    `;
    
    container.appendChild(alert);
    
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
