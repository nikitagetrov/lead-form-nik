const form = document.getElementById('leadForm');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const spinner = document.getElementById('spinner');
const submitText = document.getElementById('submitText');
const submitButton = form.querySelector('button[type="submit"]');
const langToggle = document.getElementById('langToggle');

const WEBHOOK_URL = 'https://n8n.nikitaget.top/webhook-test/372b561a-af90-4805-a623-d05d185aa163';

// ===== ЛОКАЛИЗАЦИЯ =====
const translations = {
    en: {
        title: 'Contact me',
        subtitle: "I'll respond within 24 hours",
        success: '✓ Thank you! Your message has been sent. I\'ll contact you soon.',
        error: '✗ Error sending. Please try again.',
        nameLabel: 'Name *',
        namePlaceholder: 'Enter your name',
        messageLabel: 'Your message *',
        messagePlaceholder: 'Tell me about your project or question...',
        submit: 'Send',
        submitting: 'Sending...',
        reset: 'Clear',
        info: '📌 Data from this form is automatically synced with management system. All data is protected.',
        rateLimitWait: 'Too many attempts. Please wait',
        rateLimitMinutes: 'Too many attempts. Please wait 5 minutes.',
        sendError: 'Error sending data. Check browser console.'
    },
    ru: {
        title: 'Свяжитесь со мной',
        subtitle: 'Я отвечу вам в течение 24 часов',
        success: '✓ Спасибо! Ваше сообщение отправлено. Я скоро свяжусь с вами.',
        error: '✗ Ошибка при отправке. Пожалуйста, попробуйте еще раз.',
        nameLabel: 'Имя *',
        namePlaceholder: 'Введите ваше имя',
        messageLabel: 'Ваше сообщение *',
        messagePlaceholder: 'Расскажите о вашем проекте или вопросе...',
        submit: 'Отправить',
        submitting: 'Отправляем...',
        reset: 'Очистить',
        info: '📌 Данные из этой формы автоматически синхронизируются с системой управления. Все данные защищены.',
        rateLimitWait: 'Слишком много попыток. Подождите',
        rateLimitMinutes: 'Слишком много попыток. Подождите 5 минут.',
        sendError: 'Ошибка при отправке данных. Проверьте консоль браузера.'
    }
};

let currentLang = localStorage.getItem('formLang') || 'en';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('formLang', lang);
    document.documentElement.lang = lang;
    langToggle.textContent = lang === 'en' ? 'RU' : 'EN';

    const t = translations[lang];

    // Обновляем текстовые элементы
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });

    // Обновляем плейсхолдеры
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });
}

langToggle.addEventListener('click', () => {
    setLanguage(currentLang === 'en' ? 'ru' : 'en');
});

// Инициализация языка при загрузке
setLanguage(currentLang);

// ===== RATE LIMITING =====
const RATE_LIMIT = {
    maxAttempts: 3,           // Максимум отправок
    windowMs: 60 * 1000,      // За 1 минуту
    cooldownMs: 5 * 60 * 1000 // Блокировка на 5 минут после превышения
};

function getRateLimitData() {
    const data = localStorage.getItem('formRateLimit');
    return data ? JSON.parse(data) : { attempts: [], blockedUntil: null };
}

function saveRateLimitData(data) {
    localStorage.setItem('formRateLimit', JSON.stringify(data));
}

function checkRateLimit() {
    const data = getRateLimitData();
    const now = Date.now();

    // Проверяем блокировку
    if (data.blockedUntil && now < data.blockedUntil) {
        const remainingSeconds = Math.ceil((data.blockedUntil - now) / 1000);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        return {
            allowed: false,
            message: `${translations[currentLang].rateLimitWait} ${minutes}:${seconds.toString().padStart(2, '0')}`
        };
    }

    // Очищаем старые попытки (за пределами окна)
    data.attempts = data.attempts.filter(time => now - time < RATE_LIMIT.windowMs);

    // Проверяем лимит
    if (data.attempts.length >= RATE_LIMIT.maxAttempts) {
        data.blockedUntil = now + RATE_LIMIT.cooldownMs;
        saveRateLimitData(data);
        return {
            allowed: false,
            message: translations[currentLang].rateLimitMinutes
        };
    }

    return { allowed: true };
}

function recordAttempt() {
    const data = getRateLimitData();
    data.attempts.push(Date.now());
    data.blockedUntil = null;
    saveRateLimitData(data);
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Проверка rate limit
    const rateLimitCheck = checkRateLimit();
    if (!rateLimitCheck.allowed) {
        showError(rateLimitCheck.message);
        return;
    }

    // Проверка, что webhook URL изменён
    if (WEBHOOK_URL === 'https://your-n8n-instance.com/webhook/your-webhook-name') {
        showError('⚠️ Ошибка: замени WEBHOOK_URL на адрес своего N8N вебхука!');
        return;
    }

    // Собираем данные
    const formData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        message: document.getElementById('message').value.trim(),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };

    // Показываем loader
    submitButton.disabled = true;
    spinner.classList.add('show');
    submitText.textContent = translations[currentLang].submitting;
    successMessage.classList.remove('show');
    errorMessage.classList.remove('show');

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            recordAttempt(); // Записываем успешную отправку
            showSuccess();
            form.reset();
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error:', error);
        showError(translations[currentLang].sendError);
    } finally {
        submitButton.disabled = false;
        spinner.classList.remove('show');
        submitText.textContent = translations[currentLang].submit;
    }
});

function showSuccess() {
    successMessage.classList.add('show');
    errorMessage.classList.remove('show');
    setTimeout(() => {
        successMessage.classList.remove('show');
    }, 5000);
}

function showError(message = null) {
    if (message) {
        errorMessage.textContent = message;
    }
    errorMessage.classList.add('show');
    successMessage.classList.remove('show');
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 5000);
}


