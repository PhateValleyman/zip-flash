let currentZip = "";

function exec(command) {
    return new Promise((resolve) => {
        const callbackName = "cb_" + Math.random().toString(36).substring(2, 9);
        window[callbackName] = (errno, stdout, stderr) => {
            resolve({ errno, stdout, stderr });
            delete window[callbackName];
        };
        if (window.ksu && typeof window.ksu.exec === "function") {
            window.ksu.exec(command, "{}", callbackName);
        } else {
            resolve({ errno: -1, stdout: "", stderr: "KernelSU/Magisk API unavailable" });
        }
    });
}

function toggleTheme() {
    const isLight = document.body.classList.toggle("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
}

async function reboot(target) {
    if (!confirm(`Opravdu chcete restartovat zařízení do: ${target.toUpperCase()}?`)) return;
    
    const logEl = document.getElementById("log");
    logEl.innerText += `\n[Restartování do ${target}...]\n`;
    
    if (target === "recovery") {
        await exec("/system/bin/svc power reboot recovery || /system/bin/reboot recovery");
    } else if (target === "bootloader") {
        await exec("/system/bin/svc power reboot bootloader || /system/bin/reboot bootloader");
    } else {
        await exec("/system/bin/svc power reboot || /system/bin/reboot");
    }
}

async function scanFiles() {
    const select = document.getElementById("fileSelect");
    const r = await exec("ls /storage/65D9-1787*.zip /storage/65D9-1787/Download/*.zip /storage/65D9-1787/FULL/*.zip /storage/65D9-1787/FULL/Download/*.zip /sdcard/Download/*.zip /sdcard/Download/@zip/*.zip /sdcard/*.zip 2>/dev/null");
    
    select.innerHTML = '<option value="">-- Vyberte ZIP --</option>';
    if (!r.stdout || r.stdout.trim() === "") {
        select.innerHTML = '<option value="">Žádné ZIPy nenalezeny</option>';
        return;
    }

    r.stdout.trim().split("\n").forEach(file => {
        const path = file.trim();
        const name = path.split("/").pop();
        const opt = document.createElement("option");
        opt.value = path;
        opt.innerText = name;
        select.appendChild(opt);
    });
}

function updateSelection() {
    currentZip = document.getElementById("fileSelect").value;
}

async function flash() {
    if (!currentZip) {
        alert("Nejprve vyberte ZIP soubor!");
        return;
    }
    
    let cmd = "";
    if(document.getElementById("nosystem").checked) cmd += "NOSYSTEM=1 ";
    if(document.getElementById("debug").checked) cmd += "DEBUG=1 ";
    if(document.getElementById("rw").checked) cmd += "SYSTEM_MODE=rw ";
    
    cmd += `/system/bin/zip-flash "${currentZip}"`;
    
    const logEl = document.getElementById("log");
    logEl.innerText += `\n[Instalace ZIP: ${currentZip.split('/').pop()}]\n`;
    
    let r = await exec(cmd);
    logEl.innerText += (r.stdout || "") + (r.stderr || "");
    logEl.scrollTop = logEl.scrollHeight;
    
    loadModules();
}

async function loadModules() {
    const container = document.getElementById("moduleList");
    container.innerHTML = "Načítání...";

    const cmd = `for d in /data/adb/modules/*; do
        if [ -f "$d/module.prop" ]; then
            id=$(basename "$d")
            name=$(grep '^name=' "$d/module.prop" | cut -d= -f2-)
            version=$(grep '^version=' "$d/module.prop" | cut -d= -f2-)
            disabled=0
            [ -f "$d/disable" ] && disabled=1
            has_webui=0
            [ -d "$d/webroot" ] && has_webui=1
            echo "$id|$name|$version|$disabled|$has_webui"
        fi
    done`;

    const r = await exec(cmd);
    if (!r.stdout || r.stdout.trim() === "") {
        container.innerHTML = "<i>Žádné nainstalované moduly.</i>";
        return;
    }

    container.innerHTML = "";
    const lines = r.stdout.trim().split("\n");

    lines.forEach(line => {
        const [id, name, version, disabled, has_webui] = line.split("|");
        const isChecked = disabled === "0" ? "checked" : "";
        
        const webuiBtn = has_webui === "1" 
            ? `<button class="btn-webui" onclick="openWebUI('${id}')" title="Otevřít WebUI modulu">🌐 WebUI</button>` 
            : "";

        const item = document.createElement("div");
        item.className = "module-item";
        item.innerHTML = `
            <div class="module-info">
                <strong>${name || id}</strong> <small>(${version || "v?"})</small><br>
                <small style="color: #888;">ID: ${id}</small>
            </div>
            <div class="module-controls">
                ${webuiBtn}
                <label class="switch">
                    <input type="checkbox" ${isChecked} onchange="toggleModule('${id}', this.checked)">
                    <span class="slider"></span>
                </label>
                <button class="btn-backup" onclick="backupModule('${id}')" title="Zálohovat modul do ZIP">💾</button>
                <button class="btn-remove" onclick="removeModule('${id}', '${name || id}')" title="Odinstalovat">🗑️</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function openWebUI(id) {
    // Přesměrování na WebUI modulu v prostředí KernelSU / WebUI Manageru
    window.location.href = `https://ksu.module/${id}/index.html`;
}

async function toggleModule(id, enable) {
    const logEl = document.getElementById("log");
    if (enable) {
        await exec(`rm -f /data/adb/modules/${id}/disable`);
        logEl.innerText += `\n[Modul ${id} byl ZAPNUT (vyžaduje restart)]\n`;
    } else {
        await exec(`touch /data/adb/modules/${id}/disable`);
        logEl.innerText += `\n[Modul ${id} byl VYPNUT (vyžaduje restart)]\n`;
    }
    logEl.scrollTop = logEl.scrollHeight;
}

async function backupModule(id) {
    const logEl = document.getElementById("log");
    logEl.innerText += `\n[Vytváření zálohy modulu ${id}...]\n`;
    logEl.scrollTop = logEl.scrollHeight;

    const outFile = `/sdcard/Download/${id}_backup.zip`;
    const cmd = `cd /data/adb/modules/${id} && zip -r "${outFile}" . -x "disable" "remove"`;
    
    const r = await exec(cmd);
    if (r.errno === 0) {
        logEl.innerText += `Záloha uložena do: ${outFile}\n`;
        scanFiles();
    } else {
        logEl.innerText += `Chyba při vytváření ZIP: ${r.stderr || r.stdout}\n`;
    }
    logEl.scrollTop = logEl.scrollHeight;
}

async function removeModule(id, name) {
    if (!confirm(`Opravdu chcete odinstalovat modul "${name}"?`)) return;

    const logEl = document.getElementById("log");
    logEl.innerText += `\n[Odstraňování modulu: ${id}]\n`;

    await exec(`touch /data/adb/modules/${id}/remove || rm -rf /data/adb/modules/${id}`);
    
    logEl.innerText += `Modul ${id} byl označen k odstranění.\n`;
    logEl.scrollTop = logEl.scrollHeight;
    
    loadModules();
}

document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("theme") === "light") {
        document.body.classList.add("light");
    }
    scanFiles();
    loadModules();
});
