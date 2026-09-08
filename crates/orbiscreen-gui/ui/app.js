// Orbiscreen - Desktop Dashboard Frontend (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

const isTauri = typeof window.__TAURI__ !== "undefined";

async function invoke(cmd, args = {}) {
    if (isTauri && window.__TAURI__.core && window.__TAURI__.core.invoke) {
        return await window.__TAURI__.core.invoke(cmd, args);
    }
    console.log(`[Mock/Web] invoke: ${cmd}`, args);
    if (cmd === "get_status") {
        return {
            running: true,
            frames_forwarded: 1420,
            active_clients: 1,
            total_clients: 3,
            auth_failures: 0,
            usb_devices: 1,
            encoder: "NVENC (nvh264enc)",
            capture_backend: "KWin Wayland",
            display_width: 2560,
            display_height: 1600,
            display_fps: 60,
            signaling_port: 54321,
            udp_port: 54322,
            local_ips: ["192.168.1.145"],
            session_token: "orb_test_token"
        };
    }
    return null;
}

// ── Tab Navigation ──
const navItems = document.querySelectorAll(".navItem");
const tabContents = document.querySelectorAll(".tabContent");
const pageTitle = document.getElementById("pageTitle");

const titles = {
    dashboard: "Dashboard",
    display: "Display & Stream Settings",
    doctor: "System Doctor Diagnostics",
    about: "About Orbiscreen"
};

navItems.forEach(item => {
    item.addEventListener("click", () => {
        const tab = item.getAttribute("data-tab");
        navItems.forEach(n => n.classList.remove("active"));
        tabContents.forEach(t => t.classList.remove("active"));

        item.classList.add("active");
        const target = document.getElementById(`tab-${tab}`);
        if (target) target.classList.add("active");
        pageTitle.textContent = titles[tab] || "Dashboard";
    });
});

// ── Status & Telemetry Refresh ──
const statusPill = document.getElementById("statusPill");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const btnToggleService = document.getElementById("btnToggleService");
const btnRestartService = document.getElementById("btnRestartService");

const valHostIp = document.getElementById("valHostIp");
const valPort = document.getElementById("valPort");
const valUdpPort = document.getElementById("valUdpPort");
const inpSessionUrl = document.getElementById("inpSessionUrl");
const statClients = document.getElementById("statClients");
const statUsb = document.getElementById("statUsb");
const statFrames = document.getElementById("statFrames");
const statEncoder = document.getElementById("statEncoder");
const statResolution = document.getElementById("statResolution");
const statBackend = document.getElementById("statBackend");

let isRunning = false;

async function refreshStatus() {
    try {
        const status = await invoke("get_status");
        if (!status) return;

        isRunning = status.running;

        if (isRunning) {
            statusPill.className = "statusPill online";
            statusText.textContent = "Service Running";
            btnToggleService.textContent = "Stop Service";
            btnToggleService.className = "btnPrimary danger";
        } else {
            statusPill.className = "statusPill offline";
            statusText.textContent = "Service Stopped";
            btnToggleService.textContent = "Start Service";
            btnToggleService.className = "btnPrimary";
        }

        const ip = (status.local_ips && status.local_ips.length > 0) ? status.local_ips[0] : "127.0.0.1";
        valHostIp.textContent = ip;
        valPort.textContent = status.signaling_port || "54321";
        valUdpPort.textContent = status.udp_port || "54322";

        const url = `http://${ip}:${status.signaling_port || 54321}`;
        inpSessionUrl.value = url;

        statClients.textContent = status.active_clients || "0";
        statUsb.textContent = status.usb_devices || "0";
        statFrames.textContent = (status.frames_forwarded || 0).toLocaleString();
        statEncoder.textContent = status.encoder || "Auto";
        statBackend.textContent = status.capture_backend || "KWin Wayland";
        statResolution.textContent = `${status.display_width || 1920}×${status.display_height || 1080} @ ${status.display_fps || 60}Hz`;

        drawQr(url);
    } catch (e) {
        console.warn("Status refresh error:", e);
    }
}

// ── Simple Visual QR Renderer ──
function drawQr(text) {
    const canvas = document.getElementById("qrCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "#11111b";
    // Draw QR-like corner markers
    function drawFinder(x, y) {
        ctx.fillRect(x, y, 32, 32);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 4, y + 4, 24, 24);
        ctx.fillStyle = "#11111b";
        ctx.fillRect(x + 8, y + 8, 16, 16);
    }
    drawFinder(8, 8);
    drawFinder(size - 40, 8);
    drawFinder(8, size - 40);

    // Simple pseudo-random pattern based on text hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }

    const step = 6;
    for (let y = 8; y < size - 8; y += step) {
        for (let x = 8; x < size - 8; x += step) {
            if ((x < 46 && y < 46) || (x > size - 46 && y < 46) || (x < 46 && y > size - 46)) {
                continue;
            }
            if (((x * y + hash) % 3) === 0) {
                ctx.fillRect(x, y, step - 1, step - 1);
            }
        }
    }
}

// ── Service Controls ──
btnToggleService.addEventListener("click", async () => {
    btnToggleService.disabled = true;
    if (isRunning) {
        await invoke("stop_service");
    } else {
        await invoke("start_service");
    }
    setTimeout(async () => {
        await refreshStatus();
        btnToggleService.disabled = false;
    }, 1000);
});

btnRestartService.addEventListener("click", async () => {
    btnRestartService.disabled = true;
    await invoke("restart_service");
    setTimeout(async () => {
        await refreshStatus();
        btnRestartService.disabled = false;
    }, 1200);
});

// ── Copy URL ──
const btnCopyUrl = document.getElementById("btnCopyUrl");
btnCopyUrl.addEventListener("click", () => {
    navigator.clipboard.writeText(inpSessionUrl.value);
    btnCopyUrl.textContent = "Copied!";
    setTimeout(() => { btnCopyUrl.textContent = "Copy"; }, 1500);
});

// ── Doctor Actions ──
const btnRunDoctor = document.getElementById("btnRunDoctor");
const btnFixDoctor = document.getElementById("btnFixDoctor");
if (btnRunDoctor) {
    btnRunDoctor.addEventListener("click", async () => {
        btnRunDoctor.textContent = "Scanning...";
        const res = await invoke("run_doctor_check");
        console.log("Doctor check:", res);
        btnRunDoctor.textContent = "Run Diagnostics";
    });
}
if (btnFixDoctor) {
    btnFixDoctor.addEventListener("click", async () => {
        btnFixDoctor.textContent = "Applying Fixes...";
        const res = await invoke("run_doctor_fix");
        console.log("Doctor fix:", res);
        btnFixDoctor.textContent = "Auto-Fix Missing Permissions & Rules";
    });
}

// ── Autostart Toggle ──
const chkAutostart = document.getElementById("chkAutostart");
if (chkAutostart) {
    invoke("get_autostart").then(enabled => {
        chkAutostart.checked = !!enabled;
    });
    chkAutostart.addEventListener("change", () => {
        invoke("set_autostart", { enabled: chkAutostart.checked });
    });
}

// ── External Links ──
document.querySelectorAll(".linkBtn").forEach(btn => {
    btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-url");
        if (url) {
            invoke("open_browser", { url });
        }
    });
});

// ── Init & Interval ──
refreshStatus();
setInterval(refreshStatus, 2500);
