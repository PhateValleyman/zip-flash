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
    // Search common locations and show modal with clickable list
    setBusy('Hledám ZIPy na zařízení...');
    const r = await exec("ls /storage/65D9-1787*.zip /storage/65D9-1787/Download/*.zip /storage/65D9-1787/FULL/*.zip /storage/65D9-1787/FULL/Download/*.zip /sdcard/Download/*.zip /sdcard/Download/@zip/*.zip /sdcard/*.zip 2>/dev/null");

    const modal = document.getElementById('zipModal');
    const list = document.getElementById('zipList');
    if (!modal || !list) {
        clearBusy();
        alert('Modal element nenalezen.');
        return;
    }

    if (!r.stdout || r.stdout.trim() === "") {
        list.innerHTML = '<div class="zip-empty">Žádné ZIPy nalezeny v předdefinovaných cestách.</div>';
        modal.style.display = 'block';
        clearBusy();
        return;
    }

    const lines = r.stdout.trim().split('\n');
    list.innerHTML = '';
    lines.forEach(p => {
        const path = p.trim();
        const name = path.split('/').pop();
        const item = document.createElement('div');
        item.className = 'zip-item';
        item.innerHTML = `<strong>${name}</strong><br><small style="color:#aaa">${path}</small>`;
        item.onclick = () => chooseZip(path);
        list.appendChild(item);
    });

    modal.style.display = 'block';
    clearBusy();
}

function chooseZip(path){
    currentZip = path;
    const info = document.getElementById('selectedFile');
    if(info) info.innerText = `Vybráno: ${path.split('/').pop()} (cesta: ${path})`;
    closeZipModal();
}

function closeZipModal(){
    const modal = document.getElementById('zipModal');
    if(modal) modal.style.display = 'none';
}

function updateSelection() {
    // Keep compatibility: try file picker first, then fall back to select if present
    const picker = document.getElementById('filePicker');
    if (picker && picker.files && picker.files.length > 0) {
        const name = picker.files[0].name;
        // Common location where Android file pickers pick from
        currentZip = `/sdcard/Download/${name}`;
        document.getElementById('selectedFile').innerText = `Vybráno: ${name} (předpokládaná cesta: ${currentZip})`;
        return;
    }

    const sel = document.getElementById("fileSelect");
    if (sel) currentZip = sel.value;
}

// helper bound to file input change
function bindFilePicker(){
    const picker = document.getElementById('filePicker');
    if(!picker) return;
    picker.addEventListener('change', () => {
        const info = document.getElementById('selectedFile');
        if(picker.files && picker.files.length>0){
            info.innerText = `Vybráno: ${picker.files[0].name} (bude použita cesta /sdcard/Download/)`;
            currentZip = `/sdcard/Download/${picker.files[0].name}`;
        } else {
            info.innerText = 'Žádný soubor vybrán';
            currentZip = '';
        }
    });
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
    
    setBusy('Flash ZIP: ' + currentZip.split('/').pop());
    let r = await exec(cmd);
    clearBusy();
    logEl.innerText += (r.stdout || "") + (r.stderr || "");
    logEl.scrollTop = logEl.scrollHeight;
    
    loadModules();
}

function setBusy(msg){
    document.body.classList.add('busy');
    const s = document.getElementById('spinner'); if(s) s.style.display='inline-block';
    const logEl = document.getElementById('log'); if(msg) { logEl.innerText += `\n[${msg}]\n`; logEl.scrollTop = logEl.scrollHeight; }
}
function clearBusy(){
    document.body.classList.remove('busy');
    const s = document.getElementById('spinner'); if(s) s.style.display='none';
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
                <button class="btn-restore" onclick="restoreModuleFromZip('${id}')" title="Obnovit modul z vybraného ZIP">🔁</button>
                <button class="btn-remove" onclick="removeModule('${id}', '${name || id}')" title="Odinstalovat">🗑️</button>
            </div>
        `;
        container.appendChild(item);
    });
}

async function openWebUI(id) {
    const logEl = document.getElementById('log');
    setBusy('Spouštím mmrl WebView pro ' + id);

    // Preferovat lokální file:// cesta do webrootu modulu a předat jako extra
    const fileUrl = `file:///data/adb/modules/${id}/webroot/index.html`;
    const modulePath = `/data/adb/modules/${id}/webroot`;

    // Zkusit několik intentů: 1) otevřít s data=file:// 2) poslat jako extra --es module_path 3) fallback na http lokální/https
    const cmd = `am start -n com.dergoogler.mmrl.wx/.MainActivity -d "${fileUrl}" --es module_id "${id}" --es module_path "${modulePath}" || am start -n com.dergoogler.mmrl.wx/.MainActivity --es module_id "${id}" --es module_path "${modulePath}" || am start -a android.intent.action.VIEW -d "http://127.0.0.1/ksu/${id}/index.html"`;

    const r = await exec(cmd);
    if (r.errno === 0) {
        logEl.innerText += `\n[Spuštěno v mmrl pro ${id}]\n`;
    } else {
        logEl.innerText += `\n[Neúspěch spuštění mmrl, fallback chyba: ${r.stderr || r.stdout}]\n`;
    }
    logEl.scrollTop = logEl.scrollHeight;
    clearBusy();
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
    // Create zip suitable for Magisk flashing (module files at root)
    const cmd = `cd /data/adb/modules/${id} && zip -r "${outFile}" . -x "disable" "remove"`;
    
    setBusy('Zálohování modulu ' + id);
    const r = await exec(cmd);
    clearBusy();
    if (r.errno === 0) {
        logEl.innerText += `Záloha uložena do: ${outFile}\n`;
        scanFiles();
    } else {
        logEl.innerText += `Chyba při vytváření ZIP: ${r.stderr || r.stdout}\n`;
    }
    logEl.scrollTop = logEl.scrollHeight;
}

async function restoreModuleFromZip(guessId) {
    // guessId: doporučené jméno modulu (z UI), pokud ZIP obsahuje module.prop, použije jeho id
    const logEl = document.getElementById("log");
    const zip = currentZip;
    if (!zip) {
        alert('Vyberte ZIP soubor k obnovení v poli nahoře.');
        return;
    }
    if (!confirm(`Opravdu chcete obnovit modul z ${zip.split('/').pop()} do /data/adb/modules/?`)) return;

    logEl.innerText += `\n[Obnova modulu z ${zip} ...]\n`;

    // Bezpečný jednoranový příkaz: rozbalit do temp, zjistit id z module.prop nebo použít guessId, přesunout
    const cmd = `TMP=/data/local/tmp/ziprestore_$(date +%s); rm -rf "$TMP"; mkdir -p "$TMP" && unzip -o "${zip}" -d "$TMP" >/dev/null 2>&1 || exit 2; \
if [ -f "$TMP/module.prop" ]; then \
  id=$(grep '^id=' "$TMP/module.prop" | cut -d= -f2- || true); \
  if [ -z "$id" ]; then id='${guessId}'; fi; \
else \
  id='${guessId}'; \
fi; \
if [ -z "$id" ]; then echo "NOID"; exit 3; fi; \
# Prepare destination
DEST=/data/adb/modules/$id; rm -rf "$DEST.tmp"; mv "$TMP" "$DEST.tmp" || exit 4; \
# Ensure proper ownership/permissions and cleanup
mkdir -p /data/adb/modules; mv "$DEST.tmp" "$DEST" || exit 5; chmod -R 755 "$DEST"; chown -R 0:0 "$DEST" 2>/dev/null || true; echo "OK:$id"`;

    setBusy('Obnova modulu z ' + zip.split('/').pop());
    const r = await exec(cmd);
    clearBusy();
    if (r.errno === 0 && r.stdout && r.stdout.indexOf('OK:') !== -1) {
        const newId = r.stdout.split('OK:').pop().trim();
        logEl.innerText += `Obnova dokončena: ${newId}\n`;
        loadModules();
    } else {
        logEl.innerText += `Chyba při obnově: ${r.stderr || r.stdout}\n`;
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
    bindFilePicker();
    scanFiles();
    loadModules();
});
