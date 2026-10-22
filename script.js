(function(){
  "use strict";
  var KEY = "catatanku_simple_v1";

  var ACCENTS = ["#7E6585","#C27B5F","#5F8F88","#B59A5E","#A5748A","#7C8AA8"];
  var CAT_COLORS = {Makanan:"#C27B5F",Transportasi:"#5F8F88",Kuliah:"#7E6585",Belanja:"#B59A5E",Hiburan:"#A5748A",Lainnya:"#7C8AA8"};
  var DEFAULT_TEXT = "#3b3340";   /* teks bawaan tema terang */
  var DARK_TEXT = "#ede6ef";      /* teks bawaan tema gelap  */

  var HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  var HARI_S = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
  var BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  var BULAN_S = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

  function $(id){ return document.getElementById(id); }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
  function pad(n){ return n < 10 ? "0" + n : "" + n; }

  function defaultData(){
    return {
      notes: [
        { id: uid(), title: "HELLO FADIL!!!", content: "Ketik disini", updatedAt: Date.now() }
      ],
      expenses: [],
      settings: { accent: "#7E6585", text: "#3B3340", theme: "light" }
    };
  }

  function normalize(d){
    var def = defaultData();
    d = (d && typeof d === "object") ? d : {};
    var settings = {};
    var k, src = d.settings || {};
    for(k in def.settings){ settings[k] = def.settings[k]; }
    for(k in src){ if(Object.prototype.hasOwnProperty.call(src, k)) settings[k] = src[k]; }
    return {
      notes: Array.isArray(d.notes) ? d.notes : def.notes,
      expenses: Array.isArray(d.expenses) ? d.expenses : def.expenses,
      settings: settings
    };
  }

  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      if(!raw) return defaultData();
      return normalize(JSON.parse(raw));
    }catch(e){
      console.error("Gagal memuat data, memakai data awal.", e);
      return defaultData();
    }
  }

  var DATA = load();
  var state = { tab: "notes", currentNoteId: DATA.notes[0] ? DATA.notes[0].id : null, search: "" };

  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(DATA)); }
    catch(e){ console.error("Gagal menyimpan", e); }
  }

  function fmtRp(n){
    var sign = n < 0 ? "-" : "";
    var s = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return sign + "Rp " + s;
  }
  function fmtDate(ts){
    var d = new Date(ts);
    return d.getDate() + " " + BULAN_S[d.getMonth()] + " " + d.getFullYear();
  }
  function esc(s){
    return (s||"").replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function findNote(id){
    for(var i = 0; i < DATA.notes.length; i++){ if(DATA.notes[i].id === id) return DATA.notes[i]; }
    return null;
  }

  /* ---------- Jam digital ---------- */
  function tickClock(){
    var d = new Date();
    $("clockTime").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    $("clockDateFull").textContent = HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
    $("clockDateShort").textContent = HARI_S[d.getDay()] + ", " + d.getDate() + " " + BULAN_S[d.getMonth()] + " " + d.getFullYear();
  }
  function scheduleClock(){
    tickClock();
    setTimeout(scheduleClock, 1000 - (Date.now() % 1000) + 5);
  }

  /* ---------- Tabs ---------- */
  var tabBtns = document.querySelectorAll(".tab-btn");
  Array.prototype.forEach.call(tabBtns, function(btn){
    btn.addEventListener("click", function(){
      flushNote();
      state.tab = btn.getAttribute("data-tab");
      Array.prototype.forEach.call(tabBtns, function(b){ b.classList.toggle("active", b === btn); });
      $("panel-notes").classList.toggle("active", state.tab === "notes");
      $("panel-finance").classList.toggle("active", state.tab === "finance");
      if(state.tab === "finance") renderFinance();
    });
  });

  /* ---------- Catatan ---------- */
  function visibleNotes(){
    var list = DATA.notes.slice();
    if(state.search.trim()){
      var q = state.search.trim().toLowerCase();
      list = list.filter(function(n){
        return (n.title || "").toLowerCase().indexOf(q) > -1 || (n.content || "").toLowerCase().indexOf(q) > -1;
      });
    }
    return list.sort(function(a,b){ return b.updatedAt - a.updatedAt; });
  }

  function renderNoteList(){
    var wrap = $("noteList");
    var list = visibleNotes();
    wrap.innerHTML = "";
    if(!list.length){
      wrap.innerHTML = '<div class="empty-hint">Belum ada catatan.</div>';
      return;
    }
    list.forEach(function(n){
      var item = document.createElement("button");
      item.type = "button";
      item.className = "note-item" + (n.id === state.currentNoteId ? " active" : "");
      item.innerHTML =
        '<span class="note-item__title">' + esc(n.title || "Tanpa judul") + '</span>' +
        '<span class="note-item__snip">' + esc((n.content || "").slice(0,60)) + '</span>';
      item.addEventListener("click", function(){
        flushNote();
        state.currentNoteId = n.id;
        renderNoteList();
        renderNoteEditor();
      });
      wrap.appendChild(item);
    });
  }

  function renderNoteEditor(){
    var note = findNote(state.currentNoteId);
    var empty = $("noteEmpty");
    var form = $("noteForm");
    if(!note){ empty.style.display = "block"; form.style.display = "none"; return; }
    empty.style.display = "none"; form.style.display = "flex";
    $("noteTitle").value = note.title;
    $("noteContent").value = note.content;
    $("noteMeta").textContent = "Diperbarui " + fmtDate(note.updatedAt);
  }

  /* Simpan otomatis: id catatan dicatat saat mengetik, dan sisa ketikan
     disimpan langsung bila pengguna pindah catatan/tab atau menutup halaman. */
  var pendingId = null, pendingTimer = null;

  function commitNote(){
    if(pendingId === null) return;
    var note = findNote(pendingId);
    pendingId = null;
    if(!note) return;
    note.title = $("noteTitle").value || "Tanpa judul";
    note.content = $("noteContent").value;
    note.updatedAt = Date.now();
    save();
    $("noteMeta").textContent = "Tersimpan · " + fmtDate(note.updatedAt);
    renderNoteList();
  }
  function flushNote(){
    if(pendingTimer){ clearTimeout(pendingTimer); pendingTimer = null; }
    commitNote();
  }
  function onNoteInput(){
    pendingId = state.currentNoteId;
    if(pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(function(){ pendingTimer = null; commitNote(); }, 400);
  }

  $("noteTitle").addEventListener("input", onNoteInput);
  $("noteContent").addEventListener("input", onNoteInput);

  $("btnNewNote").addEventListener("click", function(){
    flushNote();
    var note = { id: uid(), title: "Catatan baru", content: "", updatedAt: Date.now() };
    DATA.notes.unshift(note);
    state.currentNoteId = note.id;
    save(); renderNoteList(); renderNoteEditor();
    $("noteTitle").focus();
    $("noteTitle").select();
  });

  $("btnDeleteNote").addEventListener("click", function(){
    flushNote();
    var note = findNote(state.currentNoteId);
    if(!note) return;
    if(!confirm('Hapus catatan "' + note.title + '"?')) return;
    DATA.notes = DATA.notes.filter(function(n){ return n.id !== note.id; });
    state.currentNoteId = null;
    save(); renderNoteList(); renderNoteEditor();
  });

  $("searchInput").addEventListener("input", function(e){
    state.search = e.target.value;
    renderNoteList();
  });

  /* ---------- Keuangan ---------- */
  function renderFinance(){
    var list = DATA.expenses.slice().sort(function(a,b){ return b.createdAt - a.createdAt; });
    var income = 0, expense = 0;
    list.forEach(function(e){ if(e.type === "income") income += e.amount; else expense += e.amount; });
    $("statIncome").textContent = fmtRp(income);
    $("statExpense").textContent = fmtRp(expense);
    $("statBalance").textContent = fmtRp(income - expense);

    var wrap = $("txList");
    wrap.innerHTML = "";
    if(!list.length){
      wrap.innerHTML = '<div class="empty-hint">Belum ada transaksi. Tambahkan lewat form di atas.</div>';
      return;
    }
    list.forEach(function(e){
      var row = document.createElement("div");
      row.className = "tx-row";
      var color = CAT_COLORS[e.category] || "#8C8190";
      row.innerHTML =
        '<span class="tx-row__dot" style="background:' + color + '"></span>' +
        '<div class="tx-row__info">' +
          '<p class="tx-row__desc">' + esc(e.description || e.category) + '</p>' +
          '<span class="tx-row__sub">' + esc(e.category) + ' · ' + fmtDate(e.createdAt) + '</span>' +
        '</div>' +
        '<span class="tx-row__amt ' + (e.type === "income" ? "in" : "out") + '">' +
          (e.type === "income" ? "+ " : "- ") + fmtRp(e.amount) +
        '</span>' +
        '<button type="button" class="tx-row__del" title="Hapus" aria-label="Hapus transaksi">✕</button>';
      row.querySelector(".tx-row__del").addEventListener("click", function(){
        DATA.expenses = DATA.expenses.filter(function(x){ return x.id !== e.id; });
        save(); renderFinance();
      });
      wrap.appendChild(row);
    });
  }

  $("txForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target;
    var els = f.elements;
    var amount = parseFloat(els["amount"].value);
    if(!amount || amount <= 0){ alert("Isi jumlah yang valid."); return; }
    DATA.expenses.push({
      id: uid(),
      type: els["type"].value,
      description: els["desc"].value.trim(),
      category: els["category"].value,
      amount: amount,
      createdAt: Date.now()
    });
    save();
    f.reset();
    renderFinance();
  });

  /* ---------- Pengaturan ---------- */
  function effectiveText(){
    var s = DATA.settings;
    var t = String(s.text || DEFAULT_TEXT).toLowerCase();
    /* Warna teks bawaan otomatis menyesuaikan tema gelap agar tetap terbaca */
    if(s.theme === "dark" && t === DEFAULT_TEXT) return DARK_TEXT;
    return s.text;
  }

  function applySettings(){
    var s = DATA.settings;
    var root = document.documentElement;
    root.style.setProperty("--accent", s.accent);
    root.style.setProperty("--text", effectiveText());
    root.setAttribute("data-theme", s.theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute("content", s.theme === "dark" ? "#26212A" : "#FBF9FA");
  }

  function renderSettingsPop(){
    var s = DATA.settings;
    var swatchWrap = $("accentSwatches");
    swatchWrap.innerHTML = "";
    ACCENTS.forEach(function(hex){
      var sw = document.createElement("button");
      sw.type = "button";
      sw.setAttribute("aria-label", "Warna aksen " + hex);
      sw.className = "swatch" + (hex.toLowerCase() === String(s.accent).toLowerCase() ? " active" : "");
      sw.style.background = hex;
      sw.addEventListener("click", function(){
        s.accent = hex; save(); applySettings(); renderSettingsPop();
      });
      swatchWrap.appendChild(sw);
    });
    $("accentCustom").value = s.accent;
    $("textCustom").value = effectiveText();
    Array.prototype.forEach.call(document.querySelectorAll(".theme-switch button"), function(b){
      b.classList.toggle("active", b.getAttribute("data-theme") === s.theme);
    });
  }

  $("btnSettings").addEventListener("click", function(){
    $("settingsPop").classList.toggle("open");
    renderSettingsPop();
  });
  document.addEventListener("click", function(e){
    var pop = $("settingsPop");
    var btn = $("btnSettings");
    if(pop.classList.contains("open") && !pop.contains(e.target) && !btn.contains(e.target)){
      pop.classList.remove("open");
    }
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape") $("settingsPop").classList.remove("open");
  });

  $("accentCustom").addEventListener("input", function(e){
    DATA.settings.accent = e.target.value; save(); applySettings(); renderSettingsPop();
  });
  $("textCustom").addEventListener("input", function(e){
    DATA.settings.text = e.target.value; save(); applySettings();
  });
  Array.prototype.forEach.call(document.querySelectorAll(".theme-switch button"), function(btn){
    btn.addEventListener("click", function(){
      DATA.settings.theme = btn.getAttribute("data-theme"); save(); applySettings(); renderSettingsPop();
    });
  });

  $("btnExport").addEventListener("click", function(){
    flushNote();
    var blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "catatanku-cadangan.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  });

  $("importFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try{
        DATA = normalize(JSON.parse(reader.result));
        save();
        state.currentNoteId = DATA.notes[0] ? DATA.notes[0].id : null;
        applySettings(); renderNoteList(); renderNoteEditor(); renderFinance(); renderSettingsPop();
        alert("Data berhasil diimpor.");
      }catch(err){
        alert("Gagal mengimpor: file tidak valid.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  $("btnReset").addEventListener("click", function(){
    if(!confirm("Semua catatan dan transaksi akan dihapus permanen. Lanjutkan?")) return;
    if(pendingTimer){ clearTimeout(pendingTimer); pendingTimer = null; }
    pendingId = null;
    DATA = defaultData();
    save();
    state.currentNoteId = DATA.notes[0] ? DATA.notes[0].id : null;
    applySettings(); renderNoteList(); renderNoteEditor(); renderFinance(); renderSettingsPop();
  });

  /* ---------- Simpan saat halaman ditutup / disembunyikan ---------- */
  document.addEventListener("visibilitychange", function(){
    if(document.hidden) flushNote(); else tickClock();
  });
  window.addEventListener("pagehide", flushNote);

  /* ---------- Instal aplikasi (PWA) ---------- */
  var deferredPrompt = null;
  var isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  window.addEventListener("beforeinstallprompt", function(e){
    e.preventDefault();
    deferredPrompt = e;
    $("installBox").hidden = false;
  });
  $("btnInstall").addEventListener("click", function(){
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    if(deferredPrompt.userChoice && deferredPrompt.userChoice.then){
      deferredPrompt.userChoice.then(function(){ deferredPrompt = null; $("installBox").hidden = true; });
    }
  });
  window.addEventListener("appinstalled", function(){
    deferredPrompt = null; $("installBox").hidden = true; $("iosHint").hidden = true;
  });
  if(isIOS && !isStandalone) $("iosHint").hidden = false;

  if("serviceWorker" in navigator){
    window.addEventListener("load", function(){
      navigator.serviceWorker.register("./sw.js").catch(function(err){
        console.warn("Service worker gagal didaftarkan:", err);
      });
    });
  }

  /* ---------- Init ---------- */
  applySettings();
  renderNoteList();
  renderNoteEditor();
  renderFinance();
  scheduleClock();
})();
