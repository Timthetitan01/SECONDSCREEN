    const SPOTIFY_CLIENT_ID = "2aea224b957a49e0ade20938094a2170"; 
    const SPOTIFY_SCOPES = "streaming user-read-email user-read-private user-modify-playback-state user-read-currently-playing user-read-playback-state";
    let player = null; 
    let activePandoras = {};

    const CONVERSION_RATES = {
        'Length': { 'm': 1, 'km': 1000, 'cm': 0.01, 'mm': 0.001, 'in': 0.0254, 'ft': 0.3048, 'yd': 0.9144, 'mi': 1609.34 },
        'Weight': { 'kg': 1, 'g': 0.001, 'mg': 0.000001, 'lb': 0.453592, 'oz': 0.0283495 },
        'Temp': { 'C': 'c', 'F': 'f', 'K': 'k' },
        'Volume': { 'L': 1, 'ml': 0.001, 'gal': 3.78541, 'qt': 0.946353, 'pt': 0.473176, 'cup': 0.24, 'fl oz': 0.0295735, 'tbsp': 0.015, 'tsp': 0.005 },
        'Time': { 's': 1, 'min': 60, 'hr': 3600, 'day': 86400, 'wk': 604800, 'yr': 31536000 },
        'Digital': { 'B': 1, 'KB': 1024, 'MB': 1048576, 'GB': 1073741824, 'TB': 1099511627776 },
        'Speed': { 'm/s': 1, 'km/h': 0.277778, 'mph': 0.44704 }
    };

    const GlobalMedia = {
        activeSource: 'None',
        send: (action) => {
            if (GlobalMedia.activeSource === 'Spotify' && player) {
                if (action === 'playpause') Spotify.toggle(); if (action === 'next') Spotify.next(); if (action === 'prev') Spotify.prev();
                return;
            }
            if ('mediaSession' in navigator) {
                try { const keyMap = { 'playpause': 179, 'next': 176, 'prev': 177 }; if(keyMap[action]) document.dispatchEvent(new KeyboardEvent('keydown', {'keyCode': keyMap[action]})); UI.showToast("Command Sent"); } catch(e) { console.log(e); }
            }
        },
        updateDisplay: (title, artist) => {
            const text = title ? `${title} - ${artist}` : "No Active Media";
            document.querySelectorAll('.media-info-text').forEach(el => el.innerText = text);
        }
    };

    const Spotify = {
        token: null, deviceId: null,
        login: () => {
            const generateRandomString = (l) => { const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; return crypto.getRandomValues(new Uint8Array(l)).reduce((a, x) => a + p[x % p.length], ""); };
            const sha256 = async (p) => window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
            const base64encode = (i) => btoa(String.fromCharCode.apply(null, new Uint8Array(i))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            const start = async () => { const v = generateRandomString(64); localStorage.setItem('spotify_verifier', v); const hash = await sha256(v); const challenge = base64encode(hash); const url = new URL("https://accounts.spotify.com/authorize"); url.search = new URLSearchParams({ response_type: 'code', client_id: SPOTIFY_CLIENT_ID, scope: SPOTIFY_SCOPES, code_challenge_method: 'S256', code_challenge: challenge, redirect_uri: window.location.origin + window.location.pathname }).toString(); window.open(url, 'Spotify', 'width=500,height=800'); };
            start();
        },
        handleCode: async (code) => {
            const v = localStorage.getItem('spotify_verifier');
            const res = await fetch("https://accounts.spotify.com/api/token", { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: window.location.origin + window.location.pathname, code_verifier: v }) });
            const d = await res.json();
            if(d.access_token) { Spotify.token = d.access_token; localStorage.setItem('sp_token', d.access_token); UI.showToast("Connected! Loading Player..."); Spotify.initPlayer(); }
        },
        initPlayer: () => {
            const t = localStorage.getItem('sp_token'); if(!t) return; Spotify.token = t; if(player) return;
            window.onSpotifyWebPlaybackSDKReady = () => {
                player = new Spotify.Player({ name: 'StudyNest Web Player', getOAuthToken: cb => { cb(Spotify.token); }, volume: 0.5 });
                player.addListener('ready', ({ device_id }) => { Spotify.deviceId = device_id; document.querySelectorAll('.music-settings').forEach(el => { el.classList.add('active'); el.innerHTML = `<div class="music-msg" style="color:white; font-weight:bold;">Player Ready</div><button class="login-btn" onclick="Spotify.transfer()">Start Player</button>`; }); });
                player.addListener('player_state_changed', state => { if (!state) return; Spotify.updateUI(state); const track = state.track_window.current_track; GlobalMedia.activeSource = 'Spotify'; GlobalMedia.updateDisplay(track.name, track.artists[0].name); });
                player.addListener('authentication_error', () => { UI.showToast("Auth Error. Re-login"); localStorage.removeItem('sp_token'); });
                player.connect();
            };
            if(window.Spotify) window.onSpotifyWebPlaybackSDKReady();
        },
        transfer: async () => {
            if(!Spotify.deviceId || !Spotify.token) return;
            await fetch(`https://api.spotify.com/v1/...`, { method: 'PUT', headers: { 'Authorization': `Bearer ${Spotify.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ device_ids: [Spotify.deviceId], play: true }) });
            document.querySelectorAll('.music-settings').forEach(el => el.classList.remove('active'));
        },
        toggle: () => { if(player) player.togglePlay(); }, next: () => { if(player) player.nextTrack(); }, prev: () => { if(player) player.previousTrack(); },
        updateUI: (state) => {
            const track = state.track_window.current_track; if(!track) return;
            const title = track.name; const artist = track.artists[0].name; const art = track.album.images[0]?.url; const progress = (state.position / state.duration) * 100;
            document.querySelectorAll('.music-wrapper').forEach(el => {
                el.querySelector('.music-title').innerText = title; el.querySelector('.music-artist').innerText = artist;
                const artEl = el.querySelector('.music-art'); artEl.style.backgroundImage = `url('${art}')`; artEl.innerHTML = ''; 
                el.querySelector('.music-fill').style.width = `${progress}%`;
                const btn = el.querySelector('.play-btn'); btn.innerHTML = state.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>'; btn.classList.toggle('paused', state.paused);
                const overlay = el.querySelector('.music-settings'); if(overlay && !state.paused) overlay.classList.remove('active');
            });
            document.querySelectorAll('.media-play').forEach(btn => { btn.innerHTML = state.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>'; });
        }
    };

    const Utils = {
        initConverter: (id) => {
            const catSel = document.getElementById(`conv-cat-${id}`);
            Object.keys(CONVERSION_RATES).forEach(k => { const opt = document.createElement('option'); opt.value = k; opt.innerText = k; catSel.appendChild(opt); });
            Utils.updateConvUnits(id);
        },
        updateConvUnits: (id) => {
            const cat = document.getElementById(`conv-cat-${id}`).value; const fromSel = document.getElementById(`conv-from-${id}`); const toSel = document.getElementById(`conv-to-${id}`);
            fromSel.innerHTML = ''; toSel.innerHTML = '';
            Object.keys(CONVERSION_RATES[cat]).forEach(u => { const o1 = document.createElement('option'); o1.value = u; o1.innerText = u; const o2 = document.createElement('option'); o2.value = u; o2.innerText = u; fromSel.appendChild(o1); toSel.appendChild(o2); });
            toSel.selectedIndex = 1; Utils.runConversion(id);
        },
        runConversion: (id) => {
            const cat = document.getElementById(`conv-cat-${id}`).value; const val = parseFloat(document.getElementById(`conv-in-${id}`).value); const from = document.getElementById(`conv-from-${id}`).value; const to = document.getElementById(`conv-to-${id}`).value; const resEl = document.getElementById(`conv-res-${id}`);
            if (isNaN(val)) { resEl.innerText = '---'; return; }
            let result;
            if (cat === 'Temp') {
                let cVal = val; if (from === 'F') cVal = (val - 32) * 5/9; if (from === 'K') cVal = val - 273.15;
                if (to === 'C') result = cVal; if (to === 'F') result = (cVal * 9/5) + 32; if (to === 'K') result = cVal + 273.15;
            } else { const baseVal = val * CONVERSION_RATES[cat][from]; result = baseVal / CONVERSION_RATES[cat][to]; }
            resEl.innerText = Math.abs(result) < 0.001 || Math.abs(result) > 10000 ? result.toExponential(3) : parseFloat(result.toFixed(4));
        },
        unlockVault: (id) => {
            const savedHash = localStorage.getItem('study_vault_hash');
            if(!savedHash) { UI.askInput("Create Master Password", [{label:"New Password", type:"password"}], (v)=>{ if(v[0]) { localStorage.setItem('study_vault_hash', btoa(v[0])); Utils.openVault(id); UI.showToast("Master Password Set"); } }); return; }
            UI.askInput("Unlock Vault", [{label:"Master Password", type:"password"}], (v)=>{ if(btoa(v[0]) === savedHash) { Utils.openVault(id); } else { UI.showToast("Incorrect Password"); } });
        },
        openVault: (id) => { document.getElementById(`v-lock-${id}`).style.display='none'; document.getElementById(`v-open-${id}`).classList.add('active'); document.getElementById(`v-wrapper-${id}`).classList.add('vault-open-state'); },
        lockAllVaults: () => { document.querySelectorAll('.vault-open-state').forEach(el => { const id = el.id.replace('v-wrapper-',''); document.getElementById(`v-lock-${id}`).style.display='flex'; document.getElementById(`v-open-${id}`).classList.remove('active'); el.classList.remove('vault-open-state'); }); },
        addVaultItem: (id) => {
            const t = document.getElementById(`v-t-${id}`).value; const p = document.getElementById(`v-p-${id}`).value; if(!t || !p) return;
            const list = document.getElementById(`v-list-${id}`); const div = document.createElement('div'); div.className = 'vault-item';
            div.innerHTML = `<div class="v-meta"><div class="v-title">${t}</div><div class="v-pass">••••••</div></div><i class="fa-solid fa-copy v-icon"></i>`;
            div.onclick = () => { navigator.clipboard.writeText(p); UI.showToast("Password Copied"); }; div.dataset.meta = JSON.stringify({t, p});
            list.prepend(div); document.getElementById(`v-t-${id}`).value=''; document.getElementById(`v-p-${id}`).value=''; Core.saveLayout();
        },
        calc: (id, val) => {
            const s = document.getElementById(`scr-${id}`); const h = document.getElementById(`hist-${id}`); let expr = s.getAttribute('data-expr') || ''; let isRes = s.getAttribute('data-res') === 'true';
            const update = (txt, raw) => { s.innerText = txt; s.setAttribute('data-expr', raw); s.setAttribute('data-res', 'false'); };
            if (val === 'AC') { s.innerText = '0'; h.innerText = ''; s.setAttribute('data-expr', ''); s.setAttribute('data-res', 'false'); return; }
            if (val === 'DEL') { if (isRes) { update('0', ''); return; } let vTxt = s.innerText.toString(); let vExpr = expr.toString(); if (vTxt.length <= 1 || vTxt === 'Error') { update('0', ''); } else { update(vTxt.slice(0, -1), vExpr.slice(0, -1)); } return; }
            if (val === '=') {
                try { h.innerText = s.innerText + ' ='; let evalStr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').replace(/π/g, 'Math.PI').replace(/e/g, 'Math.E').replace(/√/g, 'Math.sqrt').replace(/log/g, 'Math.log10').replace(/ln/g, 'Math.log').replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan');
                    let res = eval(evalStr); res = Math.round(res * 10000000000) / 10000000000; s.innerText = res; s.setAttribute('data-expr', res.toString()); s.setAttribute('data-res', 'true');
                } catch (e) { s.innerText = "Error"; setTimeout(() => update('0', ''), 1000); } return;
            }
            if (isRes) { if (['+', '-', '×', '÷', '^', '%'].includes(val)) { s.setAttribute('data-res', 'false'); } else { expr = ''; s.innerText = ''; isRes = false; s.setAttribute('data-res', 'false'); } }
            if (s.innerText === '0' && !['.', '+', '-', '×', '÷', '^', ')', '%'].includes(val)) { s.innerText = ''; expr = ''; }
            let displayVal = val; let mathVal = val;
            if(val === 'sin') { displayVal='sin('; mathVal='sin('; } else if(val === 'cos') { displayVal='cos('; mathVal='cos('; } else if(val === 'tan') { displayVal='tan('; mathVal='tan('; } else if(val === 'log') { displayVal='log('; mathVal='log('; } else if(val === 'ln') { displayVal='ln('; mathVal='ln('; } else if(val === '√') { displayVal='√('; mathVal='√('; }
            s.innerText += displayVal; s.setAttribute('data-expr', expr + mathVal);
        },
        linkAction: (id, index, btn) => { const saved = JSON.parse(btn.getAttribute('data-link') || 'null'); if (saved && saved.url) { window.open(saved.url, '_blank'); } else { Utils.editLink(id, index, btn); } },
        editLink: (id, index, btn) => {
            const currentData = JSON.parse(btn.getAttribute('data-link') || 'null'); const defaultUrl = currentData ? currentData.url : ''; const defaultName = currentData ? currentData.name : '';
            UI.askInput("Edit Shortcut", [{ label: "Website URL", value: defaultUrl, placeholder: "google.com" }, { label: "Label", value: defaultName, placeholder: "Google" }], (values) => {
                let [url, name] = values; if (!url.startsWith('http://') && !url.startsWith('https://')) { url = 'https://' + url; } let domain; try { domain = new URL(url).hostname; } catch(e) { domain = url; }
                const data = { url, name, domain }; btn.setAttribute('data-link', JSON.stringify(data)); btn.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" class="deck-favicon"><span class="deck-label">${name}</span>`; Core.saveLayout();
            });
        },
        setCountdown: (id) => {
            const widget = document.getElementById(`count-wrap-${id}`); const currentData = JSON.parse(widget.getAttribute('data-target') || 'null'); const defaultDate = currentData ? currentData.date : ''; const defaultName = currentData ? currentData.name : '';
            UI.askInput("Set Countdown", [{ label: "Target Date", value: defaultDate, placeholder: "YYYY-MM-DD", type: "date" }, { label: "Event Name", value: defaultName, placeholder: "My Event" }], (values) => { const [date, name] = values; if (!date) return; widget.setAttribute('data-target', JSON.stringify({date, name: name || 'Event'})); Utils.updateCountdown(id); Core.saveLayout(); });
        },
        updateCountdown: (id) => {
            const widget = document.getElementById(`count-wrap-${id}`); if (!widget) return; const data = JSON.parse(widget.getAttribute('data-target') || 'null');
            if (data) { const diff = Math.ceil((new Date(data.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)); document.getElementById(`cd-val-${id}`).innerText = diff > 0 ? diff : 0; document.getElementById(`cd-lbl-${id}`).innerText = diff > 0 ? `Days until ${data.name}` : `${data.name} is here!`; const pct = Math.max(0, Math.min(100, (diff / 30) * 100)); document.getElementById(`cd-bar-${id}`).style.width = (100 - pct) + '%'; }
        },
        initCalendar: (id) => { if(!window[`cal_date_${id}`]) { window[`cal_date_${id}`] = new Date(); } Utils.renderCalendar(id); },
        changeMonth: (id, offset) => { const currentDate = window[`cal_date_${id}`]; currentDate.setMonth(currentDate.getMonth() + offset); Utils.renderCalendar(id); },
        resetCalendar: (id) => { window[`cal_date_${id}`] = new Date(); Utils.renderCalendar(id); },
        renderCalendar: (id) => {
            const date = window[`cal_date_${id}`]; const year = date.getFullYear(); const month = date.getMonth(); document.getElementById(`cal-title-${id}`).innerText = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const daysContainer = document.getElementById(`cal-grid-${id}`); daysContainer.innerHTML = ''; const firstDayIndex = new Date(year, month, 1).getDay(); const lastDay = new Date(year, month + 1, 0).getDate(); const today = new Date();
            for (let i = 0; i < firstDayIndex; i++) { const empty = document.createElement('div'); empty.classList.add('cal-day', 'empty'); daysContainer.appendChild(empty); }
            for (let i = 1; i <= lastDay; i++) { const dayEl = document.createElement('div'); dayEl.classList.add('cal-day'); dayEl.innerText = i; if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) { dayEl.classList.add('today'); } daysContainer.appendChild(dayEl); }
        },
        setTimer: (id) => {
            UI.askInput("Set Timer", [{ label: "Time (e.g. 5:00 PM or 17:00)", value: "", placeholder: "17:00" }], (values) => {
                const time = values[0]; if(!time) return; const d = new Date(); const [timeStr, mod] = time.split(' '); let [h, m] = timeStr.split(':');
                if (h === '12') h = '00'; if (mod && (mod.toLowerCase() === 'pm')) h = parseInt(h, 10) + 12; d.setHours(h, m, 0, 0);
                if(d < new Date()) { UI.showToast("Time must be in the future!"); return; }
                document.getElementById(`timer-wrap-${id}`).setAttribute('data-end', d.getTime()); document.getElementById(`timer-lbl-${id}`).innerText = `Until ${time}`; Utils.updateTimer(id); Core.saveLayout();
            });
        },
        updateTimer: (id) => {
            const el = document.getElementById(`timer-wrap-${id}`); if(!el) return; const end = parseInt(el.getAttribute('data-end')); if(!end) return;
            const diff = end - Date.now(); if(diff <= 0) { document.getElementById(`timer-val-${id}`).innerText = "Done"; return; }
            const hr = Math.floor((diff % (86400000)) / (3600000)); const mn = Math.floor((diff % (3600000)) / 60000); document.getElementById(`timer-val-${id}`).innerText = `${hr}h ${mn}m`;
        },
        updateBattery: async (id) => {
            if(navigator.getBattery) {
                try { const batt = await navigator.getBattery(); const up = () => { const lvl = Math.round(batt.level * 100); const valEl = document.getElementById(`batt-val-${id}`); const fillEl = document.getElementById(`batt-fill-${id}`); const stEl = document.getElementById(`batt-st-${id}`); if(valEl) valEl.innerText = lvl + '%'; if(fillEl) { fillEl.style.width = lvl + '%'; fillEl.style.background = batt.charging ? 'var(--success)' : (lvl<20?'var(--error)':'var(--success)'); } if(stEl) stEl.innerText = batt.charging ? 'Charging ⚡' : 'On Battery'; }; up(); batt.addEventListener('levelchange', up); batt.addEventListener('chargingchange', up); setTimeout(up, 500); } catch(e) { document.getElementById(`batt-st-${id}`).innerText = "Error"; }
            } else { document.getElementById(`batt-st-${id}`).innerText = "Not Supported"; }
        },
        genPass: (id) => { const len = document.getElementById(`rng-${id}`).value; const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*"; let pass = ""; for(let i=0; i<len; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length)); document.getElementById(`pass-${id}`).innerText = pass; document.getElementById(`lbl-${id}`).innerText = `Length: ${len}`; },
        saveClip: async (id) => { try { const text = await navigator.clipboard.readText(); if(!text) return; const list = document.getElementById(`clip-${id}`); const item = document.createElement('div'); item.className = 'clip-item'; item.innerText = text; item.onclick = () => { navigator.clipboard.writeText(text); UI.showToast("Copied to Clipboard!"); }; list.prepend(item); if(list.children.length > 5) list.lastChild.remove(); Core.saveLayout(); } catch(e) { alert("Clipboard permission required"); } },
        copyPass: (id) => { const text = document.getElementById(`pass-${id}`).innerText; if(text && text !== "CLICK GEN") { navigator.clipboard.writeText(text); UI.showToast("Password Copied!"); } },
        loadYT: (id) => {
            const input = document.getElementById(`yt-input-${id}`); const frame = document.getElementById(`yt-frame-${id}`); const setup = document.getElementById(`yt-setup-${id}`); const controls = document.getElementById(`yt-controls-${id}`); let url = input.value; let embedUrl = "";
            if(url.includes('list=')) { const listId = url.split('list=')[1].split('&')[0]; embedUrl = `https://www.youtube.com/embed/videoseries?list=${listId}`; } else if(url.includes('v=')) { const vidId = url.split('v=')[1].split('&')[0]; embedUrl = `https://www.youtube.com/embed/${vidId}`; } else if(url.includes('youtu.be/')) { const vidId = url.split('youtu.be/')[1].split('?')[0]; embedUrl = `https://www.youtube.com/embed/${vidId}`; } else { return; }
            frame.src = embedUrl; setup.style.display = 'none'; frame.style.display = 'block'; controls.style.display = 'block'; Core.saveLayout();
        },
        resetYT: (id) => { document.getElementById(`yt-frame-${id}`).src = ""; document.getElementById(`yt-frame-${id}`).style.display = "none"; document.getElementById(`yt-controls-${id}`).style.display = "none"; document.getElementById(`yt-setup-${id}`).style.display = "flex"; document.getElementById(`yt-input-${id}`).value = ""; Core.saveLayout(); },
        initWeather: (id, savedData) => { const el = document.getElementById(`temp-${id}`); const widget = el.closest('.grid-stack-item'); let unit = savedData && savedData.unit ? savedData.unit : 'F'; widget.setAttribute('data-unit', unit); navigator.geolocation.getCurrentPosition(pos => { fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`).then(r=>r.json()).then(d => { const raw = d.current_weather.temperature; widget.setAttribute('data-raw-temp', raw); Utils.renderWeather(id); }); }); el.onclick = () => { if(document.body.classList.contains('editing')) { let u = widget.getAttribute('data-unit'); u = u === 'F' ? 'C' : 'F'; widget.setAttribute('data-unit', u); Utils.renderWeather(id); Core.saveLayout(); } }; },
        renderWeather: (id) => { const el = document.getElementById(`temp-${id}`); const widget = el.closest('.grid-stack-item'); const raw = parseFloat(widget.getAttribute('data-raw-temp')); const unit = widget.getAttribute('data-unit'); if(isNaN(raw)) return; let val = raw; if(unit === 'F') val = (raw * 9/5) + 32; el.innerText = Math.round(val) + '°' + unit; },
        initCanvas: (id, savedUrl) => {
            const cvs = document.getElementById(`canv-${id}`); const ctx = cvs.getContext('2d', { willReadFrequently: true }); let currentPenColor = cvs.dataset.currentColor || '#000000'; let currentLineWidth = parseInt(cvs.dataset.currentWidth) || 3; let currentTool = cvs.dataset.currentTool || 'pen';
            const resizeCanvas = () => { const temp = ctx.getImageData(0,0, cvs.width, cvs.height); cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight; ctx.putImageData(temp, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (cvs.dataset.currentTool === 'eraser') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 20; } else { ctx.strokeStyle = cvs.dataset.currentColor || '#000000'; ctx.lineWidth = parseInt(cvs.dataset.currentWidth) || 3; } };
            const rect = cvs.getBoundingClientRect(); cvs.width = rect.width; cvs.height = rect.height; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = currentLineWidth; ctx.strokeStyle = currentPenColor;
            if (savedUrl) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = savedUrl; } new ResizeObserver(() => requestAnimationFrame(resizeCanvas)).observe(cvs);
            let isDrawing = false, lastX = 0, lastY = 0;
            const getPos = (e) => { const r = cvs.getBoundingClientRect(); if(e.touches) { return { x: Math.floor(e.touches[0].clientX - r.left), y: Math.floor(e.touches[0].clientY - r.top) }; } return { x: Math.floor(e.clientX - r.left), y: Math.floor(e.clientY - r.top) }; };
            const start = (e) => { const pos = getPos(e); if (cvs.dataset.currentTool === 'bucket') { const hex = cvs.dataset.currentColor || '#000000'; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16); Utils.floodFill(ctx, pos.x, pos.y, [r, g, b, 255]); } else { isDrawing = true; lastX = pos.x; lastY = pos.y; } e.preventDefault(); };
            const move = (e) => { if (!isDrawing) return; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(pos.x, pos.y); ctx.stroke(); lastX = pos.x; lastY = pos.y; e.preventDefault(); };
            const stop = () => { if(isDrawing) { isDrawing = false; Core.saveLayout(); } };
            cvs.addEventListener('mousedown', start); cvs.addEventListener('mousemove', move); cvs.addEventListener('mouseup', stop); cvs.addEventListener('mouseout', stop); cvs.addEventListener('touchstart', start); cvs.addEventListener('touchmove', move); cvs.addEventListener('touchend', stop);
            if(!cvs.dataset.currentTool) { cvs.dataset.currentColor = '#000000'; cvs.dataset.currentWidth = '3'; cvs.dataset.currentTool = 'pen'; }
        },
        floodFill: (ctx, startX, startY, fillColor) => {
            const canvas = ctx.canvas; const w = canvas.width; const h = canvas.height; const imageData = ctx.getImageData(0, 0, w, h); const data = imageData.data; const getPixelIndex = (x, y) => (y * w + x) * 4; const startIdx = getPixelIndex(startX, startY); const startColor = [data[startIdx], data[startIdx+1], data[startIdx+2], data[startIdx+3]];
            if (startColor[0] === fillColor[0] && startColor[1] === fillColor[1] && startColor[2] === fillColor[2]) return;
            const matchStartColor = (idx) => { return data[idx] === startColor[0] && data[idx+1] === startColor[1] && data[idx+2] === startColor[2] && data[idx+3] === startColor[3]; };
            const colorPixel = (idx) => { data[idx] = fillColor[0]; data[idx+1] = fillColor[1]; data[idx+2] = fillColor[2]; data[idx+3] = fillColor[3]; };
            const stack = [[startX, startY]];
            while (stack.length) { const [x, y] = stack.pop(); const idx = getPixelIndex(x, y); if (matchStartColor(idx)) { colorPixel(idx); if (x > 0) stack.push([x - 1, y]); if (x < w - 1) stack.push([x + 1, y]); if (y > 0) stack.push([x, y - 1]); if (y < h - 1) stack.push([x, y + 1]); } }
            ctx.putImageData(imageData, 0, 0); Core.saveLayout();
        },
        setPen: (id, color) => { const cvs = document.getElementById(`canv-${id}`); const ctx = cvs.getContext('2d'); Utils.setTool(id, 'pen'); ctx.strokeStyle = color; ctx.lineWidth = 3; cvs.dataset.currentColor = color; cvs.dataset.currentWidth = 3; },
        setTool: (id, tool) => {
            const cvs = document.getElementById(`canv-${id}`); const ctx = cvs.getContext('2d'); cvs.dataset.currentTool = tool;
            if (tool === 'eraser') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 20; } else if (tool === 'pen') { ctx.strokeStyle = cvs.dataset.currentColor || '#000000'; ctx.lineWidth = 3; }
            const parent = cvs.parentElement; parent.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); const btn = parent.querySelector(`.tool-btn[onclick*="'${tool}'"]`); if(btn) btn.classList.add('active');
        },
        clearCanvas: (id) => { const cvs = document.getElementById(`canv-${id}`); const ctx = cvs.getContext('2d'); ctx.clearRect(0, 0, cvs.width, cvs.height); Core.saveLayout(); },
        setPandora: (id) => { if(activePandoras[id]) return; UI.askInput("Open Pandora's Box", [{label: "Minutes", value: "1", type: "number", placeholder: "1"}], (values) => { const mins = parseInt(values[0]); if(!mins || mins <= 0) return; Utils.startPandora(id, mins * 60); }); },
        startPandora: (id, totalSeconds) => {
            const container = document.getElementById(`pan-${id}`); const display = document.getElementById(`pan-time-${id}`); const state = document.getElementById(`pan-state-${id}`); let remaining = totalSeconds;
            container.classList.remove('pan-finished'); display.innerText = "00:00"; display.style.color = "var(--text-main)";
            if(activePandoras[id]) clearInterval(activePandoras[id]);
            activePandoras[id] = setInterval(() => {
                remaining--; const m = Math.floor(remaining / 60).toString().padStart(2,'0'); const s = (remaining % 60).toString().padStart(2,'0'); display.innerText = `${m}:${s}`;
                const pct = remaining / totalSeconds; if(pct < 0.1 && pct > 0) { display.style.color = "var(--error)"; }
                if(remaining <= 0) { clearInterval(activePandoras[id]); delete activePandoras[id]; display.classList.add('pan-finished'); display.innerText = "DONE"; state.innerText = "Time's up!"; }
            }, 1000);
        },
        initTodo: (id, data) => {
            const list = document.getElementById(`list-${id}`), em = document.getElementById(`empty-${id}`);
            if (!list || !em) return;
            const check = () => { em.style.display = list.children.length===0 ? 'block':'none'; };
            const add = (t, d) => {
                const i = document.createElement('div'); i.className=`task-item ${d?'done':''}`;
                i.innerHTML=`<div class="task-check"><i class="fa-solid fa-check"></i></div><span class="task-text">${t}</span><i class="fa-solid fa-xmark task-delete" onclick="event.stopPropagation(); this.parentElement.remove(); Utils.checkEmpty('${id}'); Core.saveLayout()"></i>`;
                i.onclick = (e) => { 
                    if(e.target.classList.contains('task-delete')) return; 
                    i.classList.add('done'); 
                    setTimeout(()=>{ i.remove(); check(); Core.saveLayout(); },800); 
                };
                list.prepend(i); check();
            };
            const input = document.getElementById(`in-${id}`);
            if(input) input.onkeypress = (e) => { if(e.key==='Enter'&&e.target.value.trim()){ add(e.target.value,false); e.target.value=''; Core.saveLayout(); } };
            if(data) data.forEach(d => { if(!d.d) add(d.t, false); }); 
            check();
            Utils.checkEmpty = (targetId) => {
                  const l = document.getElementById(`list-${targetId}`);
                  const e = document.getElementById(`empty-${targetId}`);
                  if(l && e) e.style.display = l.children.length===0 ? 'block':'none';
            };
        }
    };

    const Templates = {
        get: (type, id, data) => {
            const validTypes = ['clock', 'links', 'countdown', 'calc', 'weather', 'todo', 'notes', 'calendar', 'music', 'timer', 'battery', 'password', 'clipboard', 'youtube', 'pandora', 'media', 'draw', 'vault', 'converter'];
            if(!validTypes.includes(type)) return `<div>Error</div>`;
            const wrap = (l, c) => `<div class="remove-widget">✕</div><div class="w-header" data-type="${type}"><span class="w-label">${l}</span></div><div class="w-content" data-type="${type}">${c}</div>`;
            const getLink = (idx, s) => { const h = s&&s.url; const icon = h ? `<img src="https://www.google.com/s2/favicons?domain=${s.domain}&sz=64" class="deck-favicon"><span class="deck-label">${s.name}</span>` : `<i class="fa-solid fa-plus deck-icon deck-unset"></i>`; return `<div class="deck-btn" onclick="Utils.linkAction('${id}', ${idx}, this)" oncontextmenu="event.preventDefault(); Utils.editLink('${id}', ${idx}, this)" data-link='${h?JSON.stringify(s):""}'>${icon}</div>`; };

            const map = {
                converter: wrap('Converter', `
                    <div class="conv-wrapper">
                        <div class="conv-row">
                            <input type="number" id="conv-in-${id}" class="conv-input" placeholder="0" oninput="Utils.runConversion('${id}')">
                            <select id="conv-cat-${id}" class="conv-select" onchange="Utils.updateConvUnits('${id}')"></select>
                        </div>
                        <div class="conv-row">
                            <select id="conv-from-${id}" class="conv-select-small" onchange="Utils.runConversion('${id}')"></select>
                            <i class="fa-solid fa-arrow-right conv-arrow"></i>
                            <select id="conv-to-${id}" class="conv-select-small" onchange="Utils.runConversion('${id}')"></select>
                        </div>
                        <div class="conv-result" id="conv-res-${id}">0</div>
                    </div>
                `),
                vault: wrap('Password Vault', `
                    <div class="vault-wrapper" id="v-wrapper-${id}">
                        <div class="vault-locked" id="v-lock-${id}">
                            <i class="fa-solid fa-lock" style="font-size:32px; opacity:0.5; color: var(--label);"></i>
                            <button class="btn btn-primary" onclick="Utils.unlockVault('${id}')">Unlock</button>
                        </div>
                        <div class="vault-unlocked" id="v-open-${id}">
                            <div class="vault-add-row">
                                <input id="v-t-${id}" placeholder="Title" style="flex:1">
                                <input id="v-p-${id}" placeholder="Password" style="flex:1">
                                <button class="btn btn-primary" style="padding:10px" onclick="Utils.addVaultItem('${id}')"><i class="fa-solid fa-plus"></i></button>
                            </div>
                            <div class="vault-list" id="v-list-${id}"></div>
                        </div>
                    </div>
                `),
                draw: wrap('Whiteboard', `<div class="draw-wrapper">
                    <div class="draw-controls">
                        <div class="draw-colors">
                            <div class="d-color" style="background:#000" onclick="Utils.setPen('${id}', '#000')"></div>
                            <div class="d-color" style="background:#FF3B30" onclick="Utils.setPen('${id}', '#FF3B30')"></div>
                            <div class="d-color" style="background:#007AFF" onclick="Utils.setPen('${id}', '#007AFF')"></div>
                            <div class="d-color" style="background:#34C759" onclick="Utils.setPen('${id}', '#34C759')"></div>
                            <div class="d-color" style="background:#FFD60A" onclick="Utils.setPen('${id}', '#FFD60A')"></div>
                            <div class="d-color" style="background:#FFFFFF" onclick="Utils.setPen('${id}', '#FFFFFF')"></div>
                        </div>
                        <div class="draw-tools">
                            <button class="tool-btn active" onclick="Utils.setTool('${id}', 'pen')" title="Pen"><i class="fa-solid fa-pen"></i></button>
                            <button class="tool-btn" onclick="Utils.setTool('${id}', 'bucket')" title="Bucket Fill"><i class="fa-solid fa-fill-drip"></i></button>
                            <button class="tool-btn" onclick="Utils.setTool('${id}', 'eraser')" title="Eraser"><i class="fa-solid fa-eraser"></i></button>
                        </div>
                        <button class="draw-btn" onclick="Utils.clearCanvas('${id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <canvas id="canv-${id}" class="draw-canvas"></canvas>
                </div>`),
                media: wrap('Universal Media', `<div class="media-widget">
                    <div class="media-info-text">No Active Media</div>
                    <div class="media-btn-group">
                        <button class="media-btn" onclick="GlobalMedia.send('prev')"><i class="fa-solid fa-backward"></i></button>
                        <button class="media-btn media-play" onclick="GlobalMedia.send('playpause')"><i class="fa-solid fa-play"></i></button>
                        <button class="media-btn" onclick="GlobalMedia.send('next')"><i class="fa-solid fa-forward"></i></button>
                    </div>
                    <div style="font-size:11px; color:var(--label); margin-top:4px; font-weight:500;">Controls active browser media</div>
                </div>`),
                pandora: `<div class="remove-widget">✕</div>
                    <div class="pan-container" id="pan-${id}" onclick="Utils.setPandora('${id}')">
                       <div class="pan-time" id="pan-time-${id}">SET</div>
                       <div class="pan-label" id="pan-state-${id}">Click to Start</div>
                    </div>`,
                clock: `<div class="remove-widget">✕</div><div class="clock-container"><div class="time-big">00:00</div><div class="date-sub">Loading...</div></div>`,
                links: wrap('Quick Links', `<div class="deck-grid">${getLink(0,data?.[0])}${getLink(1,data?.[1])}${getLink(2,data?.[2])}</div>`),
                countdown: `<div class="remove-widget">✕</div><div class="count-container" id="count-wrap-${id}" onclick="Utils.setCountdown('${id}')" data-target='${data?JSON.stringify(data):""}'><div class="count-days" id="cd-val-${id}">${data?'--':'+'}</div><div class="count-label" id="cd-lbl-${id}">${data?'Loading...':'Set Date'}</div><div class="count-progress"><div class="count-fill" id="cd-bar-${id}"></div></div></div>`,
                calc: wrap('Scientific', `<div id="hist-${id}" class="calc-hist"></div><div id="scr-${id}" class="calc-screen">0</div><div class="calc-grid-adv"><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','sin')">sin</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','cos')">cos</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','tan')">tan</button><button class="calc-btn calc-orange" onclick="Utils.calc('${id}','AC')">AC</button><button class="calc-btn calc-orange" onclick="Utils.calc('${id}','DEL')">⌫</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','ln')">ln</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','log')">log</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','(')">(</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}',')')">)</button><button class="calc-btn calc-orange" onclick="Utils.calc('${id}','÷')">÷</button><button class="calc-btn" onclick="Utils.calc('${id}','7')">7</button><button class="calc-btn" onclick="Utils.calc('${id}','8')">8</button><button class="calc-btn" onclick="Utils.calc('${id}','9')">9</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','^')">^</button><button class="calc-btn calc-orange" onclick="Utils.calc('${id}','×')">×</button><button class="calc-btn" onclick="Utils.calc('${id}','4')">4</button><button class="calc-btn" onclick="Utils.calc('${id}','5')">5</button><button class="calc-btn" onclick="Utils.calc('${id}','6')">6</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','√')">√</button><button class="calc-btn calc-orange" onclick="Utils.calc('${id}','-')">-</button><button class="calc-btn" onclick="Utils.calc('${id}','1')">1</button><button class="calc-btn" onclick="Utils.calc('${id}','2')">2</button><button class="calc-btn" onclick="Utils.calc('${id}','3')">3</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','π')">π</button><button class="calc-btn calc-orange" onclick="Utils.calc('${id}','+')">+</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','e')">e</button><button class="calc-btn" onclick="Utils.calc('${id}','0')">0</button><button class="calc-btn" onclick="Utils.calc('${id}','.')">.</button><button class="calc-btn calc-sci" onclick="Utils.calc('${id}','%')">%</button><button class="calc-btn calc-orange" onclick="Utils.calc('${id}','=')">=</button></div>`),
                weather: wrap('Weather', `<div style="display:flex;align-items:center;justify-content:center;gap:20px;height:100%"><i class="fa-solid fa-cloud-sun" style="font-size:36px;color:var(--ios-yellow)"></i><div><div id="temp-${id}" class="weather-temp" style="font-size:32px;font-weight:700">--°</div><div style="font-size:12px;color:var(--label);font-weight:600">Mostly Clear</div></div></div>`),
                todo: wrap('Reminders', `<div class="task-input-row"><input id="in-${id}" placeholder="Add task..."></div><div id="list-${id}" class="task-list"></div><div id="empty-${id}" class="task-empty">No tasks</div>`),
                notes: wrap('Notes', `<textarea id="nt-${id}" style="flex:1;resize:none;background:transparent;border:none;padding:0;font-family:inherit;font-size:15px;line-height:1.5" placeholder="Type here..." oninput="Core.saveLayout()"></textarea>`),
                calendar: `<div class="remove-widget">✕</div><div class="cal-wrapper"><div class="cal-header"><i class="fa-solid fa-chevron-left cal-nav" onclick="Utils.changeMonth('${id}', -1)"></i><span id="cal-title-${id}" class="cal-title" onclick="Utils.resetCalendar('${id}')">Month Year</span><i class="fa-solid fa-chevron-right cal-nav" onclick="Utils.changeMonth('${id}', 1)"></i></div><div class="cal-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div id="cal-grid-${id}" class="cal-grid"></div></div>`,
                music: `<div class="remove-widget">✕</div><div class="music-wrapper" id="ms-${id}"><div class="music-settings ${localStorage.getItem('sp_token') ? '' : 'active'}" id="ov-${id}"><div class="music-msg" style="color:white; font-weight:bold;">Connect Spotify Premium</div><button class="login-btn" onclick="Spotify.login()">Login</button></div><div class="music-art" id="ms-art-${id}"><i class="fa-solid fa-music music-art-icon"></i></div><div class="music-info"><div class="music-title" id="ms-title-${id}">Not Playing</div><div class="music-artist" id="ms-artist-${id}">Connect a device</div><div class="music-progress"><div class="music-fill" id="ms-fill-${id}"></div></div><div class="music-controls"><button class="ctrl-btn" onclick="Spotify.prev()"><i class="fa-solid fa-backward-step"></i></button><button class="ctrl-btn play-btn" onclick="Spotify.toggle()"><i class="fa-solid fa-play"></i></button><button class="ctrl-btn" onclick="Spotify.next()"><i class="fa-solid fa-forward-step"></i></button></div></div></div>`,
                timer: wrap('Event Timer', `<div class="timer-container" id="timer-wrap-${id}" onclick="Utils.setTimer('${id}')"><div id="timer-val-${id}" class="timer-big">--:--</div><div id="timer-lbl-${id}" class="timer-label">Click to Set</div><div class="timer-bar"><div id="timer-bar-${id}" class="timer-fill"></div></div></div>`),
                battery: wrap('Battery', `<div class="batt-container"><div class="batt-icon-shell"><div class="batt-fill" id="batt-fill-${id}"></div></div><div><div id="batt-val-${id}" class="batt-text">--%</div><div id="batt-st-${id}" class="batt-state">Reading...</div></div></div>`),
                password: wrap('Pass Gen', `<div id="pass-${id}" class="pass-display" onclick="Utils.copyPass('${id}')">CLICK GEN</div><div class="pass-controls"><span id="lbl-${id}" style="font-size:12px;color:var(--label);width:65px;font-weight:700;">Length: 16</span><input type="range" id="rng-${id}" min="8" max="32" value="16" style="flex:1" oninput="Utils.genPass('${id}')"><button class="btn btn-primary" onclick="Utils.genPass('${id}')">Gen</button></div>`),
                clipboard: wrap('Clipboard', `<button class="btn btn-primary" style="width:100%; justify-content:center; margin-bottom: 4px;" onclick="Utils.saveClip('${id}')"><i class="fa-solid fa-paste"></i> Save Recent</button><div id="clip-${id}" class="clip-list"></div>`),
                youtube: `<div class="remove-widget">✕</div><div class="yt-container"><div id="yt-setup-${id}" class="yt-setup"><i class="fa-brands fa-youtube" style="font-size:48px;color:#FF0000;margin-bottom:10px"></i><input id="yt-input-${id}" placeholder="Paste YouTube Link..." style="text-align:center;" onkeypress="if(event.key==='Enter') Utils.loadYT('${id}')"><button class="btn btn-primary" onclick="Utils.loadYT('${id}')">Load Video</button></div><iframe id="yt-frame-${id}" class="yt-frame" style="display:none" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe><div id="yt-controls-${id}" class="yt-controls" style="display:none"><button class="btn btn-danger" onclick="Utils.resetYT('${id}')"><i class="fa-solid fa-xmark"></i></button></div></div>`,
            };
            return map[type] || `<div>Error</div>`;
        }
    };
