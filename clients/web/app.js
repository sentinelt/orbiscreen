// Orbiscreen - app.js (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

const I18N = {
    en: {
        btnInputMode: "Input Mode",
        btnKeyboard: "Keyboard",
        btnLock: "Lock Session",
        btnSettings: "Settings",
        btnHideControls: "Hide Toolbar",
        btnFullscreen: "Fullscreen",
        btnDisconnect: "Disconnect",
        btnShowControls: "Menu",
        btnCloseKeyboard: "Close",
        settingsTitle: "Settings",
        themeTitle: "Theme",
        themeDark: "Dark",
        themeLight: "Light",
        language: "Language",
        fitMode: "Scaling",
        fitContain: "Fit",
        fitCover: "Fill",
        fitNone: "100%",
        perfStats: "Telemetry",
        latency: "Latency",
        resolution: "Resolution",
        encoder: "Encoder",
        hostActions: "Host Actions",
        actionResync: "Resync",
        statusConnecting: "Connecting",
        statusConnectingSub: "Connecting...",
        statusConnectingSub: "Connecting to Linux host...",
        statusConnected: "Connected",
        statusDisconnected: "Disconnected",
        statusStreamError: "Stream Error",
        statusStreamErrorSub: "Reconnecting...",
        statusAuthFailed: "Auth Required",
        statusAuthFailedSub: "Enter session token",
        tokenPlaceholder: "Session token...",
        btnConnect: "Connect",
        btnReconnect: "Reconnect",
        vncActive: "Pointer Locked · Press <kbd>Esc</kbd> to unlock",
        cursorReleased: "Pointer unlocked",
        modeTouch: "Touch",
        modeTouchpad: "Touchpad",
        controlsHidden: "Toolbar hidden",
        toastLocked: "Locked",
        toastLockSent: "Lock sent",
        toastCadSent: "Ctrl+Alt+Del sent",
        toastResynced: "Resynced",
        toastDisconnected: "Disconnected",
        statusUnsupported: "Unsupported browser",
        statusUnsupportedSub: "This client needs the WebCodecs VideoDecoder API. Open the page in Chrome, Brave, Edge, or another Chromium browser."
    },
    ar: {
        btnInputMode: "وضع الإدخال",
        btnKeyboard: "لوحة المفاتيح",
        btnLock: "قفل الجلسة",
        btnSettings: "الإعدادات",
        btnHideControls: "إخفاء شريط الأدوات",
        btnFullscreen: "ملء الشاشة",
        btnDisconnect: "قطع الاتصال",
        btnRestoreToolbar: "إظهار شريط الأدوات",
        btnCloseKeyboard: "إغلاق",
        settingsTitle: "الإعدادات",
        themeTitle: "المظهر (الثيم)",
        themeDark: "داكن",
        themeLight: "فاتح",
        language: "اللغة",
        fitMode: "تنسيق العرض",
        fitContain: "احتواء",
        fitCover: "ملء الشاشة",
        fitNone: "100%",
        perfStats: "بيانات الأداء",
        latency: "التأخير",
        resolution: "الدقة",
        encoder: "المرمّز",
        hostActions: "إجراءات المضيف",
        actionResync: "إعادة المزامنة",
        statusConnecting: "جارِ الاتصال",
        statusConnectingSub: "الاتصال بمضيف لينكس...",
        statusConnected: "متصل",
        statusDisconnected: "انقطع الاتصال",
        statusStreamError: "خطأ في البث",
        statusStreamErrorSub: "جارِ إعادة المحاولة...",
        statusAuthFailed: "المصادقة مطلوبة",
        statusAuthFailedSub: "أدخل رمز الجلسة للمتابعة",
        tokenPlaceholder: "رمز الجلسة...",
        btnConnect: "اتصال",
        btnReconnect: "إعادة الاتصال",
        vncActive: "المؤشر محصور · اضغط <kbd>Esc</kbd> للتحرير",
        cursorReleased: "تم تحرير المؤشر",
        modeTouch: "اللمس",
        modeTouchpad: "لوحة اللمس",
        controlsHidden: "تم إخفاء الشريط",
        toastLocked: "تم القفل",
        toastLockSent: "تم إرسال أمر القفل",
        toastCadSent: "تم إرسال Ctrl+Alt+Del",
        toastResynced: "تمت المزامنة",
        toastDisconnected: "تم قطع الاتصال",
        statusUnsupported: "متصفح غير مدعوم",
        statusUnsupportedSub: "يحتاج هذا العميل إلى WebCodecs VideoDecoder. افتح الصفحة في Chrome أو Brave أو Edge أو متصفح Chromium آخر."
    }
};

let currentLang = localStorage.getItem("orbiscreen_web_lang") || "en";

function t(key) {
    const dict = I18N[currentLang] || I18N.en;
    return dict[key] || I18N.en[key] || key;
}

function applyTranslations() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = (currentLang === "ar") ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const k = el.getAttribute("data-i18n");
        if (k && t(k)) el.textContent = t(k);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        const k = el.getAttribute("data-i18n-title");
        if (k && t(k)) el.title = t(k);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const k = el.getAttribute("data-i18n-placeholder");
        if (k && t(k)) el.placeholder = t(k);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
        const k = el.getAttribute("data-i18n-html");
        if (k && t(k)) el.innerHTML = t(k);
    });

    const lblWebLang = document.getElementById("lblWebLang");
    if (lblWebLang) {
        lblWebLang.textContent = (currentLang === "ar") ? "EN" : "عربي";
    }

    document.querySelectorAll("#webLangChips .chipBtn").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
    });
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem("orbiscreen_web_lang", lang);
    applyTranslations();
}

let currentTheme = localStorage.getItem("orbiscreen_web_theme") || "dark";

function applyTheme(theme) {
    currentTheme = theme;
    localStorage.setItem("orbiscreen_web_theme", theme);

    if (theme === "light") {
        document.body.classList.add("theme-light");
    } else {
        document.body.classList.remove("theme-light");
    }

    const iconDark = document.getElementById("iconThemeDark");
    const iconLight = document.getElementById("iconThemeLight");
    if (iconDark && iconLight) {
        if (theme === "light") {
            iconDark.classList.add("hidden");
            iconLight.classList.remove("hidden");
        } else {
            iconLight.classList.add("hidden");
            iconDark.classList.remove("hidden");
        }
    }

    document.querySelectorAll("#webThemeChips .chipBtn").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-theme") === theme);
    });
}

const statusTitle = document.getElementById("statusTitle");
const statusSubtitle = document.getElementById("statusSubtitle");
const overlayEl = document.getElementById("overlay");
const brandLogo = document.getElementById("brandLogo");
const statusSpinner = document.getElementById("statusSpinner");
const statusIcon = document.getElementById("statusIcon");
const btnReconnect = document.getElementById("btnReconnect");
const stageEl = document.getElementById("stage");
const videoEl = document.getElementById("remoteVideo");
const touchIndicator = document.getElementById("touchIndicator");
const controlToolbar = document.getElementById("controlToolbar");
const btnShowControls = document.getElementById("btnShowControls");
const hostNameEl = document.getElementById("hostName");
const hostInfoEl = document.getElementById("hostInfo");

function setOverlayState(state, title, subtitle) {
    if (overlayEl) overlayEl.classList.remove("hidden");
    if (statusTitle && title) statusTitle.textContent = title;
    if (statusSubtitle && subtitle) statusSubtitle.textContent = subtitle;

    releaseControl();
    hideControlsChrome();
    if (keyboardDrawer) keyboardDrawer.classList.add("hidden");
    if (settingsModal) settingsModal.classList.add("hidden");

    if (state === "connecting") {
        if (brandLogo) brandLogo.classList.add("hidden");
        if (statusSpinner) statusSpinner.classList.remove("hidden");
        if (btnReconnect) btnReconnect.classList.add("hidden");
    } else if (state === "unsupported") {
        if (statusSpinner) statusSpinner.classList.add("hidden");
        if (brandLogo) brandLogo.classList.remove("hidden");
        if (btnReconnect) btnReconnect.classList.add("hidden");
    } else {
        if (statusSpinner) statusSpinner.classList.add("hidden");
        if (brandLogo) brandLogo.classList.remove("hidden");
        if (btnReconnect) btnReconnect.classList.remove("hidden");
    }
}

const btnInputMode = document.getElementById("btnInputMode");
const iconMouse = document.getElementById("iconMouse");
const iconTouch = document.getElementById("iconTouch");
const btnKeyboard = document.getElementById("btnKeyboard");
const btnLock = document.getElementById("btnLock");
const btnSettings = document.getElementById("btnSettings");
const btnHideControls = document.getElementById("btnHideControls");
const btnFullscreen = document.getElementById("btnFullscreen");
const btnDisconnect = document.getElementById("btnDisconnect");
const btnThemeToggle = document.getElementById("btnThemeToggle");
const iconThemeDark = document.getElementById("iconThemeDark");
const iconThemeLight = document.getElementById("iconThemeLight");
const btnWebLang = document.getElementById("btnWebLang");
const lblWebLang = document.getElementById("lblWebLang");
const btnRestoreToolbar = document.getElementById("btnRestoreToolbar");

const keyboardDrawer = document.getElementById("keyboardDrawer");
const btnCloseKeyboard = document.getElementById("btnCloseKeyboard");
const keyboardImeInput = document.getElementById("keyboardImeInput");
const btnSendCad = document.getElementById("btnSendCad");

const settingsModal = document.getElementById("settingsModal");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const statLatency = document.getElementById("statLatency");
const statRes = document.getElementById("statRes");
const statEncoder = document.getElementById("statEncoder");
const btnActionResync = document.getElementById("btnActionResync");

const vncBanner = document.getElementById("vncBanner");
const toastEl = document.getElementById("toast");
const tokenRow = document.getElementById("tokenRow");
const tokenInput = document.getElementById("tokenInput");
const btnConnect = document.getElementById("btnConnect");

let displayWidth = 1920;
let displayHeight = 1080;
let encoderName = "NVENC";
let authToken = "";
let wtConfig = null;
let wtTransport = null;
let wtWriter = null;
let videoDecoder = null;
let reconnectTimer = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 10000;
let clockOffsetNs = 0n;
let lastFrameAt = 0;
let streamActive = false;
let isVncFocused = false;
let isTouchMode = true;
let toastTimer = null;
let vncBannerTimer = null;
let latencyWatchdog = null;
let lastDelayMs = null;
let controlsVisible = false;
let controlsLockedHidden = false;
let controlsHideTimer = null;
const heldKeys = new Set();
const pressedButtons = new Set();
const activeTouches = new Map();
let pendingMove = null;
let moveRaf = null;

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("token")) {
    authToken = urlParams.get("token");
} else if (window.location.hash && window.location.hash.length > 1) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.has("token")) {
        authToken = hashParams.get("token");
    }
}

function showToast(text, duration = 2200) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.classList.add("hidden");
    }, duration);
}

window.addEventListener("resize", () => updateInfoDisplay());

function updateInfoDisplay() {
    const delayText = (lastDelayMs != null && lastDelayMs >= 0)
        ? `delay ${lastDelayMs}ms`
        : "delay —";
    const narrow = window.matchMedia("(orientation: portrait), (max-width: 720px)").matches;
    const infoStr = narrow
        ? delayText
        : `${displayWidth}×${displayHeight}  ${encoderName}  ${delayText}`;
    if (hostInfoEl) hostInfoEl.textContent = infoStr;
    if (statRes) statRes.textContent = `${displayWidth} × ${displayHeight}`;
    if (statEncoder) statEncoder.textContent = encoderName;
    if (statLatency) {
        statLatency.textContent = (lastDelayMs != null && lastDelayMs >= 0)
            ? `${lastDelayMs} ms`
            : "-- ms";
    }
}

function hideControlsChrome() {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
    controlsVisible = false;
    if (controlToolbar) controlToolbar.classList.add("hidden");
    if (btnShowControls) btnShowControls.classList.add("hidden");
}

function setControlsVisible(visible) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
    if (!streamActive) {
        hideControlsChrome();
        return;
    }
    if (controlsLockedHidden) {
        if (controlToolbar) controlToolbar.classList.add("hidden");
        if (btnShowControls) btnShowControls.classList.add("hidden");
        controlsVisible = false;
        return;
    }
    controlsVisible = visible;
    if (visible) {
        if (controlToolbar) controlToolbar.classList.remove("hidden");
        if (btnShowControls) btnShowControls.classList.add("hidden");
        controlsHideTimer = setTimeout(() => setControlsVisible(false), 12_000);
    } else {
        if (controlToolbar) controlToolbar.classList.add("hidden");
        if (btnShowControls) btnShowControls.classList.remove("hidden");
    }
}

function setVncFocus(focused) {
    if (focused && !streamActive) return;
    if (focused === isVncFocused) return;
    isVncFocused = focused;
    if (focused) {
        stageEl.classList.add("vncFocused");
        stageEl.focus();
        showVncBanner();
    } else {
        releaseControl();
        showToast("Cursor released", 1400);
    }
}

function showVncBanner() {
    if (!vncBanner) return;
    vncBanner.classList.remove("hidden");
    clearTimeout(vncBannerTimer);
    vncBannerTimer = setTimeout(() => {
        vncBanner.classList.add("hidden");
    }, 2400);
}

function releaseControl() {
    isVncFocused = false;
    if (stageEl) stageEl.classList.remove("vncFocused");
    if (vncBanner) vncBanner.classList.add("hidden");
    releaseAllKeys();
    releaseAllButtons();
}

function releaseAllKeys() {
    for (const code of heldKeys) {
        sendInput({ Key: { code, pressed: false } });
    }
    heldKeys.clear();
    const modifiers = [29, 97, 42, 54, 56, 100, 125, 126];
    for (const code of modifiers) {
        sendInput({ Key: { code, pressed: false } });
    }
}

function releaseAllButtons() {
    for (const button of pressedButtons) {
        sendInput({ Pointer: { Button: { button, pressed: false } } });
    }
    pressedButtons.clear();
    releaseAllTouches();
    hideTouch();
}

window.addEventListener("blur", () => {
    releaseControl();
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        releaseControl();
    }
});

if (overlayEl) {
    overlayEl.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
    });
}

function usesTouchInput(event) {
    if (event.pointerType === "pen") return false;
    return isTouchMode;
}

function sendTouchAt(pointerId, x, y, pressed) {
    let rec = activeTouches.get(pointerId);
    if (!rec) {
        if (!pressed) return;
        const used = new Set();
        for (const t of activeTouches.values()) used.add(t.slot);
        let slot = 0;
        while (used.has(slot) && slot < 9) slot += 1;
        rec = { slot, id: pointerId & 0x7fffffff };
        activeTouches.set(pointerId, rec);
    }
    sendInput({ Touch: { slot: rec.slot, id: rec.id, x, y, pressed } });
    if (!pressed) activeTouches.delete(pointerId);
}

function releaseAllTouches() {
    for (const rec of activeTouches.values()) {
        sendInput({ Touch: { slot: rec.slot, id: rec.id, x: 0, y: 0, pressed: false } });
    }
    activeTouches.clear();
}

function applyInputModeIcons() {
    if (!iconMouse || !iconTouch) return;
    if (isTouchMode) {
        iconMouse.classList.add("hidden");
        iconTouch.classList.remove("hidden");
    } else {
        iconMouse.classList.remove("hidden");
        iconTouch.classList.add("hidden");
    }
}

stageEl.addEventListener("pointerdown", (event) => {
    if (!streamActive) return;
    if (!isVncFocused) {
        setVncFocus(true);
    }
    event.preventDefault();
    try {
        event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_) { /* capture is best-effort on older WebViews */ }
    const { x, y } = mapPointer(event);
    if (event.pointerType === "pen") {
        sendStylus(x, y, event.pressure, event.tiltX, event.tiltY);
        showTouch(event.clientX, event.clientY);
        return;
    }
    if (usesTouchInput(event)) {
        sendTouchAt(event.pointerId, x, y, true);
        showTouch(event.clientX, event.clientY);
        return;
    }
    sendPointerMove(x, y);
    sendPointerButton(event.button + 1, true);
    showTouch(event.clientX, event.clientY);
});

stageEl.addEventListener("pointermove", (event) => {
    if (!streamActive) return;
    const touching = usesTouchInput(event) || activeTouches.has(event.pointerId);
    if (!isVncFocused && !touching) return;
    event.preventDefault();
    const { x, y } = mapPointer(event);
    if (event.pointerType === "pen") {
        if (event.buttons > 0) {
            sendStylus(x, y, event.pressure, event.tiltX, event.tiltY);
            showTouch(event.clientX, event.clientY);
        }
        return;
    }
    if (touching) {
        if (event.buttons > 0 || activeTouches.has(event.pointerId)) {
            sendTouchAt(event.pointerId, x, y, true);
            showTouch(event.clientX, event.clientY);
        }
        return;
    }
    if (!isVncFocused) return;
    if (event.buttons > 0) {
        showTouch(event.clientX, event.clientY);
        sendPointerMove(x, y);
    } else {
        queuePointerMove(x, y);
    }
});

stageEl.addEventListener("pointerup", (event) => {
    if (!streamActive) return;
    event.preventDefault();
    try {
        event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_) { /* already released */ }
    const { x, y } = mapPointer(event);
    if (event.pointerType === "pen") {
        sendStylus(x, y, 0, event.tiltX, event.tiltY);
        hideTouch();
        return;
    }
    if (usesTouchInput(event) || activeTouches.has(event.pointerId)) {
        sendTouchAt(event.pointerId, x, y, false);
        if (activeTouches.size === 0) hideTouch();
        return;
    }
    if (!isVncFocused) return;
    sendPointerButton(event.button + 1, false);
    hideTouch();
});

stageEl.addEventListener("pointerleave", (event) => {
    if (activeTouches.has(event.pointerId)) {
        const { x, y } = mapPointer(event);
        sendTouchAt(event.pointerId, x, y, false);
        if (activeTouches.size === 0) hideTouch();
        return;
    }
    if (isVncFocused && !isTouchMode) {
        releaseAllButtons();
    }
});

stageEl.addEventListener("pointercancel", (event) => {
    if (activeTouches.has(event.pointerId)) {
        const { x, y } = mapPointer(event);
        sendTouchAt(event.pointerId, x, y, false);
        if (activeTouches.size === 0) hideTouch();
        return;
    }
    if (isVncFocused && !isTouchMode) {
        releaseAllButtons();
    }
});

stageEl.addEventListener("wheel", (event) => {
    if (!streamActive || !isVncFocused) return;
    event.preventDefault();
    sendWheel(normalizeWheel(event));
}, { passive: false });

window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
        event.preventDefault();
        if (isVncFocused) {
            setVncFocus(false);
        }
        keyboardDrawer.classList.add("hidden");
        settingsModal.classList.add("hidden");
        unlatchAll();
        return;
    }
    if (event.code === "F11") {
        event.preventDefault();
        toggleFullscreen();
        return;
    }
    if (!isVncFocused || !streamActive || event.repeat) return;
    if (event.target === keyboardImeInput) return;
    event.preventDefault();
    sendKey(event.code, true);
});

window.addEventListener("keyup", (event) => {
    if (event.code === "Escape" || event.code === "F11") return;
    if (!isVncFocused || !streamActive) return;
    if (event.target === keyboardImeInput) return;
    event.preventDefault();
    sendKey(event.code, false);
});

applyInputModeIcons();

if (btnInputMode) {
    btnInputMode.addEventListener("click", (e) => {
        e.stopPropagation();
        isTouchMode = !isTouchMode;
        applyInputModeIcons();
        showToast(isTouchMode ? t("modeTouch") : t("modeTouchpad"));
    });
}

if (btnKeyboard) {
    btnKeyboard.addEventListener("click", (e) => {
        e.stopPropagation();
        keyboardDrawer.classList.toggle("hidden");
        if (!keyboardDrawer.classList.contains("hidden")) {
            if (keyboardImeInput) {
                keyboardImeInput.focus();
            }
            if (!isVncFocused) {
                setVncFocus(true);
            }
        } else {
            unlatchAll();
        }
    });
}

if (btnCloseKeyboard) {
    btnCloseKeyboard.addEventListener("click", (e) => {
        e.stopPropagation();
        keyboardDrawer.classList.add("hidden");
        unlatchAll();
    });
}

if (btnSettings) {
    btnSettings.addEventListener("click", (e) => {
        e.stopPropagation();
        settingsModal.classList.remove("hidden");
    });
}

if (btnCloseSettings) {
    btnCloseSettings.addEventListener("click", () => {
        settingsModal.classList.add("hidden");
    });
}

if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add("hidden");
        }
    });
}

document.querySelectorAll(".chipBtn[data-fit]").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".chipBtn[data-fit]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (videoEl) videoEl.style.objectFit = btn.dataset.fit;
        showToast(`Fit: ${btn.textContent}`);
    });
});

if (btnThemeToggle) {
    btnThemeToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        applyTheme(currentTheme === "dark" ? "light" : "dark");
    });
}

if (btnWebLang) {
    btnWebLang.addEventListener("click", (e) => {
        e.stopPropagation();
        setLanguage(currentLang === "en" ? "ar" : "en");
    });
}

document.querySelectorAll("#webThemeChips .chipBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const theme = btn.getAttribute("data-theme");
        if (theme) applyTheme(theme);
    });
});

document.querySelectorAll("#webLangChips .chipBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const lang = btn.getAttribute("data-lang");
        if (lang) setLanguage(lang);
    });
});

if (btnHideControls) {
    btnHideControls.addEventListener("click", (e) => {
        e.stopPropagation();
        controlsLockedHidden = true;
        setControlsVisible(false);
        showToast(t("controlsHidden"), 1800);
    });
}

if (btnShowControls) {
    btnShowControls.addEventListener("click", (e) => {
        e.stopPropagation();
        setControlsVisible(true);
    });
}

stageEl.addEventListener("dblclick", (e) => {
    if (!streamActive || !controlsLockedHidden) return;
    e.preventDefault();
    controlsLockedHidden = false;
    setControlsVisible(true);
});

if (btnFullscreen) {
    btnFullscreen.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });
}

async function sendHostAction(action, extra = {}) {
    const headers = { "content-type": "application/json" };
    if (authToken) headers.authorization = `Bearer ${authToken}`;
    try {
        const res = await fetch("/api/control", {
            method: "POST",
            headers,
            body: JSON.stringify({ action, ...extra }),
        });
        return res.ok;
    } catch (err) {
        console.warn(`Host action ${action} failed:`, err);
        return false;
    }
}

const IDR_DEBOUNCE_MS = 250;
let lastIdrAt = 0;
let waitingForKeyframe = false;

function noteKeyframe() {
    waitingForKeyframe = false;
}

function requestIdr(opts = {}) {
    const now = Date.now();
    if (now - lastIdrAt < IDR_DEBOUNCE_MS) return false;
    lastIdrAt = now;
    if (!opts.keepDecoding) waitingForKeyframe = true;
    if (wtWriter) {
        try { wtWriter.write(OrbiAnnexB.encodeCtrl(OrbiAnnexB.TYPE_IDR)); } catch (_) {}
    }
    sendHostAction("idr", displaySessionId ? { session: displaySessionId } : {});
    return true;
}

if (btnLock) {
    btnLock.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await sendHostAction("lock");
        showToast(ok ? t("toastLocked") : t("toastLockSent"));
    });
}


if (btnSendCad) {
    btnSendCad.addEventListener("click", async (e) => {
        e.stopPropagation();
        await sendHostAction("ctrl_alt_del");
        showToast(t("toastCadSent"));
    });
}

if (btnActionResync) {
    btnActionResync.addEventListener("click", (e) => {
        e.stopPropagation();
        settingsModal.classList.add("hidden");
        requestIdr();
        startStream();
        showToast(t("toastResynced"));
    });
}

if (btnDisconnect) {
    btnDisconnect.addEventListener("click", (e) => {
        e.stopPropagation();
        destroyPlayer();
        setOverlayState("disconnected", t("statusDisconnected"), t("statusDisconnected"));
        showToast(t("toastDisconnected"));
    });
}

if (btnReconnect) {
    btnReconnect.addEventListener("click", (e) => {
        e.stopPropagation();
        setOverlayState("connecting", t("statusConnecting"), t("statusConnectingSub"));
        startStream();
    });
}

if (btnConnect && tokenInput) {
    btnConnect.addEventListener("click", () => {
        const val = tokenInput.value.trim();
        if (val) {
            authToken = val;
            tokenRow.classList.add("hidden");
            startStream();
        }
    });
}

function sendInput(payload) {
    const headers = { "content-type": "application/json" };
    if (authToken) headers.authorization = `Bearer ${authToken}`;
    if (displaySessionId) headers["x-orbiscreen-session"] = displaySessionId;
    fetch("/input", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
    }).catch((err) => console.warn("sendInput failed:", err));
}

function sendPointerMove(x, y) {
    sendInput({ Pointer: { Move: { x, y } } });
}

function queuePointerMove(x, y) {
    pendingMove = { x, y };
    if (!moveRaf) {
        moveRaf = requestAnimationFrame(() => {
            if (pendingMove) {
                sendPointerMove(pendingMove.x, pendingMove.y);
                pendingMove = null;
            }
            moveRaf = null;
        });
    }
}

function sendPointerButton(button, pressed) {
    if (pressed) {
        pressedButtons.add(button);
    } else {
        pressedButtons.delete(button);
    }
    sendInput({ Pointer: { Button: { button, pressed } } });
}

function sendWheel(deltaY) {
    sendInput({ Pointer: { Wheel: { delta_y: deltaY } } });
}

function normalizeWheel(event) {
    const vh = (videoEl && (videoEl.videoHeight || videoEl.height)) || displayHeight;
    let pixels = event.deltaY;
    if (event.deltaMode === 1) pixels *= 16;
    else if (event.deltaMode === 2) pixels *= vh;
    return Math.max(-12, Math.min(12, pixels / 100));
}

const KEYCODE_MAP = {
    Escape: 1, Enter: 28, Backspace: 14, Tab: 15, Space: 57,
    ArrowUp: 103, ArrowDown: 108, ArrowLeft: 105, ArrowRight: 106,
    ShiftLeft: 42, ShiftRight: 54, ControlLeft: 29, ControlRight: 97,
    AltLeft: 56, AltRight: 100, MetaLeft: 125, MetaRight: 126,
    Delete: 111, Insert: 110, Home: 102, End: 107,
    PageUp: 104, PageDown: 109, CapsLock: 58, NumLock: 69,
    ScrollLock: 70, PrintScreen: 99, Pause: 119, ContextMenu: 127,
};
for (let i = 0; i < 10; i += 1) KEYCODE_MAP[`F${i + 1}`] = 59 + i;
KEYCODE_MAP.F11 = 87;
KEYCODE_MAP.F12 = 88;
for (let i = 0; i < 10; i += 1) {
    KEYCODE_MAP[`Digit${(i + 1) % 10}`] = 2 + i;
    KEYCODE_MAP[`Numpad${i}`] = i === 0 ? 82 : 71 + (i - 1);
}
const LETTER_KEYCODES = {
    A: 30, B: 48, C: 46, D: 32, E: 18, F: 33, G: 34, H: 35, I: 23,
    J: 36, K: 37, L: 38, M: 50, N: 49, O: 24, P: 25, Q: 16, R: 19,
    S: 31, T: 20, U: 22, V: 47, W: 17, X: 45, Y: 21, Z: 44,
};
for (const [letter, code] of Object.entries(LETTER_KEYCODES)) {
    KEYCODE_MAP[`Key${letter}`] = code;
}
Object.assign(KEYCODE_MAP, {
    Minus: 12, Equal: 13, BracketLeft: 26, BracketRight: 27,
    Backslash: 43, Semicolon: 39, Quote: 40, Backquote: 41,
    Comma: 51, Period: 52, Slash: 53, IntlBackslash: 86,
    NumpadAdd: 78, NumpadSubtract: 74, NumpadMultiply: 55,
    NumpadDivide: 98, NumpadEnter: 96, NumpadDecimal: 83, NumpadComma: 121,
});

function sendKey(domCode, pressed) {
    const code = KEYCODE_MAP[domCode];
    if (code === undefined) return;
    if (pressed) {
        heldKeys.add(code);
    } else {
        heldKeys.delete(code);
    }
    sendInput({ Key: { code, pressed } });
}

function sendStylus(x, y, pressure, tiltX, tiltY) {
    sendInput({
        Stylus: {
            Tilt: {
                x, y, pressure,
                tilt_x_deg: tiltX,
                tilt_y_deg: tiltY,
            },
        },
    });
}

const latchedModifiers = {
    ControlLeft: false,
    AltLeft: false,
    ShiftLeft: false,
    MetaLeft: false,
};

function sendRawCode(code, pressed) {
    if (pressed) {
        heldKeys.add(code);
    } else {
        heldKeys.delete(code);
    }
    sendInput({ Key: { code, pressed } });
}

function unlatchAll() {
    const latches = [
        { key: "ControlLeft", code: 29 },
        { key: "AltLeft", code: 56 },
        { key: "ShiftLeft", code: 42 },
        { key: "MetaLeft", code: 125 },
    ];
    for (const { key, code } of latches) {
        if (latchedModifiers[key]) {
            latchedModifiers[key] = false;
            sendRawCode(code, false);
            const btn = document.querySelector(`.keyBtn[data-latch="${key}"]`);
            if (btn) btn.classList.remove("active");
        }
    }
}

function keyCodeFor(c) {
    const upper = c.toUpperCase();
    if (LETTER_KEYCODES[upper]) return LETTER_KEYCODES[upper];
    const map = {
        '0': 11, '1': 2, '2': 3, '3': 4, '4': 5,
        '5': 6, '6': 7, '7': 8, '8': 9, '9': 10,
        ' ': 57, '\n': 28, '\t': 15,
        '-': 12, '=': 13, '[': 26, ']': 27,
        ';': 39, "'": 40, '`': 41, '\\': 43,
        ',': 51, '.': 52, '/': 53,
    };
    return map[c] || 0;
}

function sendChar(c) {
    const shiftedChars = {
        '!': 2, '@': 3, '#': 4, '$': 5, '%': 6,
        '^': 7, '&': 8, '*': 9, '(': 10, ')': 11,
        '_': 12, '+': 13, '{': 26, '}': 27, ':': 39,
        '"': 40, '~': 41, '|': 43, '<': 51, '>': 52, '?': 53,
    };
    if (c >= 'A' && c <= 'Z') {
        const code = keyCodeFor(c);
        if (code) {
            sendRawCode(42, true);
            sendRawCode(code, true);
            sendRawCode(code, false);
            sendRawCode(42, false);
        }
    } else if (shiftedChars[c]) {
        const code = shiftedChars[c];
        sendRawCode(42, true);
        sendRawCode(code, true);
        sendRawCode(code, false);
        sendRawCode(42, false);
    } else {
        const code = keyCodeFor(c);
        if (code) {
            sendRawCode(code, true);
            sendRawCode(code, false);
        }
    }
}

document.querySelectorAll(".keyBtn").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
    });
});

document.querySelectorAll(".keyBtn[data-code]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const code = btn.dataset.code;
        sendKey(code, true);
        setTimeout(() => {
            sendKey(code, false);
            unlatchAll();
        }, 50);
    });
});

document.querySelectorAll(".keyBtn[data-latch]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const latchKey = btn.dataset.latch;
        const rawCode = parseInt(btn.dataset.raw, 10);
        latchedModifiers[latchKey] = !latchedModifiers[latchKey];
        const active = latchedModifiers[latchKey];
        btn.classList.toggle("active", active);
        sendRawCode(rawCode, active);
    });
});

document.querySelectorAll(".keyBtn[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const keyMap = { undo: 44, copy: 46, paste: 47 };
        const key = keyMap[action];
        if (key) {
            sendRawCode(29, true);
            sendRawCode(key, true);
            setTimeout(() => {
                sendRawCode(key, false);
                sendRawCode(29, false);
                unlatchAll();
            }, 50);
        }
    });
});

if (keyboardImeInput) {
    const DUMMY = "   ";
    keyboardImeInput.value = DUMMY;

    keyboardImeInput.addEventListener("keydown", (e) => {
        if (e.key === "Backspace") {
            e.preventDefault();
            sendRawCode(14, true);
            setTimeout(() => sendRawCode(14, false), 40);
        } else if (e.key === "Enter") {
            e.preventDefault();
            sendRawCode(28, true);
            setTimeout(() => {
                sendRawCode(28, false);
                unlatchAll();
            }, 40);
        } else if (e.key === "Tab") {
            e.preventDefault();
            sendRawCode(15, true);
            setTimeout(() => sendRawCode(15, false), 40);
        } else if (e.key === "Escape") {
            e.preventDefault();
            keyboardDrawer.classList.add("hidden");
            unlatchAll();
        }
    });

    keyboardImeInput.addEventListener("input", () => {
        const val = keyboardImeInput.value;
        if (val.length < DUMMY.length || !val) {
            sendRawCode(14, true);
            setTimeout(() => sendRawCode(14, false), 40);
        } else if (val.length > DUMMY.length) {
            const added = val.substring(DUMMY.length);
            for (const ch of added) {
                sendChar(ch);
            }
            unlatchAll();
        }
        keyboardImeInput.value = DUMMY;
    });
}

function mapPointer(event) {
    const target = videoEl;
    const rect = target.getBoundingClientRect();
    const vw = target.videoWidth || target.width || displayWidth;
    const vh = target.videoHeight || target.height || displayHeight;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const offsetX = (rect.width - vw * scale) / 2;
    const offsetY = (rect.height - vh * scale) / 2;
    const clamp = (v, max) => Math.max(0, Math.min(max, v));
    return {
        x: clamp((event.clientX - rect.left - offsetX) / scale, vw - 1),
        y: clamp((event.clientY - rect.top - offsetY) / scale, vh - 1),
    };
}

function showTouch(x, y) {
    if (!touchIndicator) return;
    touchIndicator.style.left = `${x}px`;
    touchIndicator.style.top = `${y}px`;
    touchIndicator.classList.remove("hidden");
}

function hideTouch() {
    if (touchIndicator) touchIndicator.classList.add("hidden");
}

function playbackSupport() {
    return {
        webTransport: typeof WebTransport === "function",
        videoDecoder: typeof VideoDecoder === "function",
        annexb: typeof OrbiAnnexB !== "undefined",
    };
}

function canPlayWebTransport() {
    const s = playbackSupport();
    return s.webTransport && s.annexb && s.videoDecoder;
}

function unsupportedPlayback() {
    setOverlayState("unsupported", t("statusUnsupported"), t("statusUnsupportedSub"));
}

function closeDecoder() {
    if (videoDecoder) {
        try { videoDecoder.close(); } catch (_) {}
        videoDecoder = null;
    }
}

function destroyPlayer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (wtWriter) {
        try { wtWriter.close(); } catch (_) {}
        wtWriter = null;
    }
    if (wtTransport) {
        try { wtTransport.close(); } catch (_) {}
        wtTransport = null;
    }
    closeDecoder();
    streamActive = false;
    clearInterval(latencyWatchdog);
    releaseControl();
}

async function fetchClientConfig() {
    try {
        const cfg = await fetch("/client/config.json");
        if (cfg.ok) return await cfg.json();
    } catch (error) {
        console.warn("config.json fetch failed:", error);
    }
    return null;
}

async function refreshToken() {
    if (authToken) return;
    const info = await fetchClientConfig();
    if (info && typeof info.token === "string" && info.token.length > 0) {
        authToken = info.token;
    }
}

function scheduleReconnect(reason) {
    if (reconnectTimer) return;
    destroyPlayer();
    setOverlayState("connecting", "Connecting", `Reconnecting (${reason})…`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        (async () => {
            await refreshToken();
            const sessionGone = !displaySessionId
                || /close|attach|session|no display/i.test(String(reason || ""));
            if (sessionGone) {
                displaySessionId = "";
                await openDisplaySession();
            }
            startStream();
        })().catch((error) => {
            console.warn("reconnect attempt failed:", error);
            displaySessionId = "";
            scheduleReconnect("retry error");
        });
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

function markPlaying() {
    if (!streamActive) {
        streamActive = true;
        reconnectDelay = 1000;
        controlsLockedHidden = false;
        if (overlayEl) overlayEl.classList.add("hidden");
        setControlsVisible(false);
    }
    noteKeyframe();
    lastFrameAt = Date.now();
}

function drawVideoFrame(frame) {
    try {
        if (videoEl.width !== frame.displayWidth || videoEl.height !== frame.displayHeight) {
            videoEl.width = frame.displayWidth;
            videoEl.height = frame.displayHeight;
            displayWidth = frame.displayWidth;
            displayHeight = frame.displayHeight;
            updateInfoDisplay();
        }
        const ctx = videoEl.getContext("2d");
        ctx.drawImage(frame, 0, 0);
        markPlaying();
    } finally {
        frame.close();
    }
}

function ensureDecoder(codec) {
    if (videoDecoder && videoDecoder.state !== "closed") {
        return videoDecoder;
    }
    closeDecoder();
    videoDecoder = new VideoDecoder({
        output: drawVideoFrame,
        error: (err) => {
            console.error("VideoDecoder error:", err);
            requestIdr();
            scheduleReconnect("decoder");
        },
    });
    videoDecoder.configure({
        codec,
        optimizeForLatency: true,
        hardwareAcceleration: "prefer-hardware",
    });
    return videoDecoder;
}

function nowNs() {
    return BigInt(Date.now()) * 1000000n;
}

function feedAccessUnit(msg) {
    if (typeof VideoDecoder !== "function") {
        unsupportedPlayback();
        return;
    }
    if (msg.key) {
        const found = OrbiAnnexB.extractSpsPps(msg.au);
        const codec = OrbiAnnexB.codecStringFromSps(found.sps);
        if (codec) {
            try {
                ensureDecoder(codec);
            } catch (err) {
                console.error("VideoDecoder configure failed:", err);
                scheduleReconnect("codec");
                return;
            }
        }
        noteKeyframe();
    }
    if (!videoDecoder || videoDecoder.state !== "configured") {
        requestIdr();
        return;
    }
    if (waitingForKeyframe && !msg.key) {
        requestIdr();
        return;
    }
    const chunk = new EncodedVideoChunk({
        type: msg.key ? "key" : "delta",
        timestamp: Number(msg.ptsNs / 1000n),
        data: msg.au,
    });
    try {
        videoDecoder.decode(chunk);
    } catch (err) {
        console.warn("decode failed:", err);
        closeDecoder();
        requestIdr();
    }
    if (msg.sentNs > 0n) {
        const glass = Number((nowNs() + clockOffsetNs - msg.sentNs) / 1000000n);
        if (glass >= 0 && glass <= 5000) {
            lastDelayMs = glass;
            updateInfoDisplay();
        }
    }
}

async function startAuStream() {
    const params = new URLSearchParams();
    if (authToken) params.set("token", authToken);
    if (displaySessionId) params.set("session", displaySessionId);
    const qs = params.toString();
    const res = await fetch(qs ? `/au?${qs}` : "/au", {
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
    });
    if (!res.ok || !res.body) {
        throw new Error(`au stream ${res.status}`);
    }
    const reader = res.body.getReader();
    const frames = new OrbiAnnexB.FrameReader();
    (async () => {
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                frames.push(value);
                let msg;
                while ((msg = frames.pop())) {
                    if (msg.type === "video") feedAccessUnit(msg);
                }
            }
            scheduleReconnect("au ended");
        } catch (err) {
            scheduleReconnect(err.message || "au");
        }
    })();
    waitingForKeyframe = true;
    requestIdr();
    if (latencyWatchdog) clearInterval(latencyWatchdog);
    latencyWatchdog = setInterval(() => {
        if (waitingForKeyframe) requestIdr();
        if (!streamActive) return;
        if (lastFrameAt && Date.now() - lastFrameAt > 750) {
            requestIdr({ keepDecoding: true });
            if (Date.now() - lastFrameAt > 3000) startStream({ quiet: true });
        }
    }, 250);
}

async function startStream(opts = {}) {
    if (!window.isSecureContext) {
        const host = (wtConfig && OrbiAnnexB.pickWtHost(wtConfig, window.location.hostname))
            || window.location.hostname
            || "host";
        const port = (wtConfig && wtConfig.wt_port) || 8790;
        setOverlayState(
            "error",
            "Open the HTTPS client",
            `WebTransport needs a secure page. Open https://${host}:${port}/client/ and accept the certificate.`,
        );
        return;
    }
    if (typeof VideoDecoder !== "function") {
        unsupportedPlayback();
        return;
    }
    if (!canPlayWebTransport()) {
        const s = playbackSupport();
        const missing = [
            !s.webTransport && "WebTransport",
            !s.annexb && "protocol helpers",
        ].filter(Boolean).join(" and ");
        setOverlayState("error", "Playback Error", `This browser is missing ${missing}`);
        return;
    }
    destroyPlayer();
    lastDelayMs = null;
    clockOffsetNs = 0n;
    lastFrameAt = 0;
    if (!opts.quiet) {
        setOverlayState("connecting", "Connecting", "Connecting to Linux virtual display…");
    }

    const cfg = wtConfig || {};
    const port = cfg.wt_port;
    const path = cfg.wt_path || "/orbiscreen";
    const hashB64 = cfg.cert_sha256;
    if (!port || !hashB64) {
        setOverlayState("error", "Playback Error", "Host did not advertise WebTransport");
        return;
    }

    const host = OrbiAnnexB.pickWtHost(cfg, window.location.hostname);
    const url = `https://${host}:${port}${path}`;
    waitingForKeyframe = true;

    try {
        const hash = OrbiAnnexB.hashFromBase64(hashB64);
        let transport;
        let lastErr;
        for (const opts of [
            { serverCertificateHashes: [{ algorithm: "sha-256", value: hash }] },
            {},
        ]) {
            let candidate;
            try {
                candidate = new WebTransport(url, opts);
                await Promise.race([
                    candidate.ready,
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error("webtransport ready timeout")), 4000);
                    }),
                ]);
                transport = candidate;
                lastErr = null;
                break;
            } catch (err) {
                lastErr = err;
                try { if (candidate) candidate.close(); } catch (_) {}
            }
        }
        if (!transport) {
            console.warn("webtransport failed, using HTTPS AU stream:", lastErr);
            await startAuStream();
            return;
        }
        wtTransport = transport;
        const bidi = await transport.createBidirectionalStream();
        const writer = bidi.writable.getWriter();
        wtWriter = writer;
        await writer.write(OrbiAnnexB.encodeHello(authToken, displaySessionId || ""));

        const reader = bidi.readable.getReader();
        const frames = new OrbiAnnexB.FrameReader();
        (async () => {
            try {
                while (wtTransport === transport) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    frames.push(value);
                    let msg;
                    while ((msg = frames.pop())) {
                        if (msg.type === "helloAck") {
                            if (msg.width) displayWidth = msg.width;
                            if (msg.height) displayHeight = msg.height;
                            updateInfoDisplay();
                            requestIdr();
                        } else if (msg.type === "video") {
                            feedAccessUnit(msg);
                        } else if (msg.type === "pong") {
                            const now = nowNs();
                            const rtt = now - msg.t0Ns;
                            clockOffsetNs = msg.hostNs + rtt / 2n - now;
                        }
                    }
                }
            } catch (err) {
                if (wtTransport === transport) {
                    console.error("webtransport read:", err);
                    displaySessionId = "";
                    scheduleReconnect(err.message || "transport");
                }
            }
        })();

        const assembler = new OrbiAnnexB.DatagramAssembler();
        let dgramReader = null;
        try {
            dgramReader = transport.datagrams.readable.getReader();
        } catch (err) {
            console.warn("webtransport datagrams unavailable:", err);
        }
        if (dgramReader) {
            (async () => {
                try {
                    while (wtTransport === transport) {
                        const { value, done } = await dgramReader.read();
                        if (done) break;
                        const msg = assembler.push(value);
                        if (!msg) continue;
                        if (msg.type === "gap") {
                            waitingForKeyframe = true;
                            requestIdr();
                            continue;
                        }
                        if (msg.type === "video") feedAccessUnit(msg);
                    }
                } catch (err) {
                    // Video can still arrive on the control stream or /au.
                    console.warn("webtransport datagram:", err);
                }
            })();
        }
    } catch (err) {
        console.error("webtransport connect:", err);
        if (!authToken && tokenRow) tokenRow.classList.remove("hidden");
        scheduleReconnect(err.message || "connect");
        return;
    }

    const wtStartedAt = Date.now();
    let auFallback = false;
    latencyWatchdog = setInterval(() => {
        if (waitingForKeyframe) requestIdr();
        if (wtWriter) {
            try { wtWriter.write(OrbiAnnexB.encodePing(nowNs())); } catch (_) {}
        }
        if (!auFallback && !streamActive && Date.now() - wtStartedAt > 3500) {
            auFallback = true;
            console.warn("webtransport produced no picture; falling back to /au");
            try { if (wtWriter) wtWriter.close(); } catch (_) {}
            try { if (wtTransport) wtTransport.close(); } catch (_) {}
            wtWriter = null;
            wtTransport = null;
            startAuStream().catch((err) => {
                scheduleReconnect(err.message || "au");
            });
            return;
        }
        if (!streamActive) return;
        if (lastFrameAt && Date.now() - lastFrameAt > 750) {
            requestIdr({ keepDecoding: true });
            if (Date.now() - lastFrameAt > 3000) {
                startStream({ quiet: true });
            }
        }
    }, 250);
}

let displaySessionId = "";

function webDeviceKey() {
    const store = "orbiscreen.deviceKey";
    try {
        const existing = localStorage.getItem(store);
        if (existing && /^[0-9a-f]{8}$/.test(existing)) {
            return existing;
        }
        const bytes = new Uint8Array(4);
        crypto.getRandomValues(bytes);
        const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        localStorage.setItem(store, key);
        return key;
    } catch (_) {
        return "web";
    }
}

async function openDisplaySession() {
    if (!authToken) return;
    try {
        const body = {
            name: (typeof navigator !== "undefined" && navigator.userAgent)
                ? navigator.userAgent.split(/[()]/)[0].trim() || "web"
                : "web",
            key: webDeviceKey(),
            width: window.screen?.width || displayWidth || 1920,
            height: window.screen?.height || displayHeight || 1080,
        };
        const response = await fetch("/api/session", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.id) {
            displaySessionId = data.id;
            if (Number.isFinite(data.width) && Number.isFinite(data.height)) {
                displayWidth = data.width;
                displayHeight = data.height;
            }
            if (typeof data.encoder === "string") {
                encoderName = data.encoder.toUpperCase();
            }
        }
    } catch (error) {
        console.warn("session open failed:", error);
    }
}

async function start() {
    applyTheme(currentTheme);
    applyTranslations();
    if (typeof VideoDecoder !== "function") {
        unsupportedPlayback();
        return;
    }
    const info = await fetchClientConfig();
    if (info) {
        wtConfig = info;
        if (!authToken && typeof info.token === "string" && info.token.length > 0) {
            authToken = info.token;
        }
        if (Number.isFinite(info.display_width) && Number.isFinite(info.display_height)) {
            displayWidth = info.display_width;
            displayHeight = info.display_height;
        }
    }
    try {
        const response = await fetch("/api/info");
        if (response.ok) {
            const apiInfo = await response.json();
            if (Number.isFinite(apiInfo?.display_width) && Number.isFinite(apiInfo?.display_height)) {
                displayWidth = apiInfo.display_width;
                displayHeight = apiInfo.display_height;
            }
            if (typeof apiInfo?.encoder === "string") {
                encoderName = apiInfo.encoder.toUpperCase();
            }
            wtConfig = Object.assign({}, wtConfig || {}, apiInfo);
        }
    } catch (error) {
        console.warn("api/info fetch failed:", error);
    }

    await openDisplaySession();
    updateInfoDisplay();
    startStream();
}



start().catch((error) => {
    setOverlayState("error", "Initialization Failed", error.message);
    console.error(error);
});
