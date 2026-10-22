(function(){
  "use strict";
  var KEY = "catatanku_simple_v1";
  var PKEY = "catatanku_pomo_state_v1";

  var ACCENTS = ["#7E6585","#C27B5F","#5F8F88","#B59A5E","#A5748A","#7C8AA8"];
  var CAT_COLORS = {Makanan:"#C27B5F",Transportasi:"#5F8F88",Kuliah:"#7E6585",Belanja:"#B59A5E",Hiburan:"#A5748A",Lainnya:"#7C8AA8"};
  var DEFAULT_TEXT = "#3b3340";   /* teks bawaan tema terang */
  var DARK_TEXT = "#ede6ef";      /* teks bawaan tema gelap  */
  var PRIO = {
    high:{label:"Tinggi", color:"#C27B5F", w:0},
    med:{label:"Sedang", color:"#B59A5E", w:1},
    low:{label:"Rendah", color:"#5F8F88", w:2}
  };
  var PANELS = ["notes","finance","tasks","focus"];

  var HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  var HARI_S = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
  var BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  var BULAN_S = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

  var BASE_TITLE = document.title;

  function $(id){ return document.getElementById(id); }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
  function pad(n){ return n < 10 ? "0" + n : "" + n; }

  /* ---------- Data ---------- */
  function defaultPomo(){ return { work: 25, brk: 5, log: [] }; }

  function defaultData(){
    return {
      notes: [
        { id: uid(), title: "HELLO FADIL!!!", content: "Ketik disini", tags: [], updatedAt: Date.now() }
      ],
      expenses: [],
      tasks: [],
      budget: 0,
      pomo: defaultPomo(),
      settings: { accent: "#7E6585", text: "#3B3340", theme: "light" }
    };
  }

  function clampInt(v, min, max, fallback){
    v = Math.round(+v);
    if(!isFinite(v) || v < min) return fallback;
    return v > max ? max : v;
  }

  /* Data lama (tanpa tag/tugas/anggaran/pomodoro) otomatis dilengkapi */
  function normalize(d){
    var def = defaultData();
    d = (d && typeof d === "object") ? d : {};
    var settings = {};
    var k, src = d.settings || {};
    for(k in def.settings){ settings[k] = def.settings[k]; }
    for(k in src){ if(Object.prototype.hasOwnProperty.call(src, k)) settings[k] = src[k]; }

    var notes = Array.isArray(d.notes) ? d.notes.filter(function(n){ return n && typeof n === "object"; }).map(function(n){
      return {
        id: n.id || uid(),
        title: typeof n.title === "string" ? n.title : "",
        content: typeof n.content === "string" ? n.content : "",
        tags: Array.isArray(n.tags) ? n.tags.filter(function(t){ return typeof t === "string" && t; }) : [],
        updatedAt: +n.updatedAt || Date.now()
      };
    }) : def.notes;

    var tasks = Array.isArray(d.tasks) ? d.tasks.filter(function(t){ return t && typeof t.title === "string"; }).map(function(t){
      return {
        id: t.id || uid(),
        title: t.title,
        priority: PRIO[t.priority] ? t.priority : "med",
        due: typeof t.due === "string" ? t.due : "",
        done: !!t.done,
        createdAt: +t.createdAt || Date.now()
      };
    }) : [];

    var pomo = defaultPomo();
    if(d.pomo && typeof d.pomo === "object"){
      pomo.work = clampInt(d.pomo.work, 1, 180, 25);
      pomo.brk = clampInt(d.pomo.brk, 1, 60, 5);
      if(Array.isArray(d.pomo.log)){
        pomo.log = d.pomo.log.filter(function(x){ return x && +x.ts > 0; }).slice(-500);
      }
    }

    return {
      notes: notes,
      expenses: Array.isArray(d.expenses) ? d.expenses : def.expenses,
      tasks: tasks,
      budget: +d.budget > 0 ? Math.round(+d.budget) : 0,
      pomo: pomo,
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
  var state = {
    tab: "notes",
    currentNoteId: DATA.notes[0] ? DATA.notes[0].id : null,
    search: "",
    tagFilter: "",
    finPeriod: monthKey(Date.now()),
    taskFilter: "all"
  };

  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(DATA)); }
    catch(e){ console.error("Gagal menyimpan", e); }
  }

  /* ---------- Util format ---------- */
  function fmtRp(n){
    var sign = n < 0 ? "-" : "";
    var s = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return sign + "Rp " + s;
  }
  function fmtShort(n){
    n = Math.abs(n);
    if(n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "").replace(".", ",") + " M";
    if(n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "").replace(".", ",") + " jt";
    if(n >= 1e3) return Math.round(n / 1e3) + " rb";
    return String(Math.round(n));
  }
  function fmtDate(ts){
    var d = new Date(ts);
    return d.getDate() + " " + BULAN_S[d.getMonth()] + " " + d.getFullYear();
  }
  function monthKey(ts){
    var d = new Date(ts);
    if(isNaN(d.getTime())) return "0000-00";
    return d.getFullYear() + "-" + pad(d.getMonth() + 1);
  }
  function monthLabel(key){
    var p = key.split("-");
    var m = +p[1];
    if(!m || m < 1 || m > 12) return "Tanpa tanggal";
    return BULAN[m - 1] + " " + p[0];
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
      PANELS.forEach(function(p){ $("panel-" + p).classList.toggle("active", p === state.tab); });
      if(state.tab === "finance") renderFinance();
      if(state.tab === "tasks") renderTasks();
      if(state.tab === "focus") renderFocus();
    });
  });

  /* ---------- Catatan ---------- */
  function allTags(){
    var seen = {}, out = [];
    DATA.notes.forEach(function(n){
      (n.tags || []).forEach(function(t){
        var k = t.toLowerCase();
        if(!seen[k]){ seen[k] = 1; out.push(t); }
      });
    });
    return out.sort(function(a,b){ return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
  }

  function visibleNotes(){
    var list = DATA.notes.slice();
    if(state.tagFilter){
      list = list.filter(function(n){
        return (n.tags || []).some(function(t){ return t.toLowerCase() === state.tagFilter; });
      });
    }
    if(state.search.trim()){
      var q = state.search.trim().toLowerCase();
      list = list.filter(function(n){
        return (n.title || "").toLowerCase().indexOf(q) > -1 ||
               (n.content || "").toLowerCase().indexOf(q) > -1 ||
               (n.tags || []).join(" ").toLowerCase().indexOf(q) > -1;
      });
    }
    return list.sort(function(a,b){ return b.updatedAt - a.updatedAt; });
  }

  function renderTagFilter(){
    var wrap = $("tagFilter");
    var tags = allTags();
    if(state.tagFilter && !tags.some(function(t){ return t.toLowerCase() === state.tagFilter; })) state.tagFilter = "";
    wrap.innerHTML = "";
    if(!tags.length){ wrap.hidden = true; return; }
    wrap.hidden = false;
    function mk(label, val){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.tagFilter === val ? " active" : "");
      b.textContent = label;
      b.addEventListener("click", function(){
        state.tagFilter = val;
        renderTagFilter();
        renderNoteList();
      });
      wrap.appendChild(b);
    }
    mk("Semua", "");
    tags.forEach(function(t){ mk("#" + t, t.toLowerCase()); });
  }

  function renderNoteList(){
    var wrap = $("noteList");
    var list = visibleNotes();
    wrap.innerHTML = "";
    if(!list.length){
      wrap.innerHTML = '<div class="empty-hint">' + (DATA.notes.length ? "Tidak ada catatan yang cocok." : "Belum ada catatan.") + '</div>';
      return;
    }
    list.forEach(function(n){
      var item = document.createElement("button");
      item.type = "button";
      item.className = "note-item" + (n.id === state.currentNoteId ? " active" : "");
      var tg = (n.tags || []).slice(0,3).map(function(t){ return "#" + t; }).join(" ");
      item.innerHTML =
        '<span class="note-item__title">' + esc(n.title || "Tanpa judul") + '</span>' +
        '<span class="note-item__snip">' + esc((n.content || "").slice(0,60)) + '</span>' +
        (tg ? '<span class="note-item__tags">' + esc(tg) + '</span>' : '');
      item.addEventListener("click", function(){
        flushNote();
        state.currentNoteId = n.id;
        renderNoteList();
        renderNoteEditor();
      });
      wrap.appendChild(item);
    });
  }

  function renderTagEditor(){
    var note = findNote(state.currentNoteId);
    var wrap = $("tagChips");
    wrap.innerHTML = "";
    if(!note) return;
    (note.tags || []).forEach(function(t){
      var chip = document.createElement("span");
      chip.className = "tag";
      chip.appendChild(document.createTextNode("#" + t));
      var x = document.createElement("button");
      x.type = "button";
      x.className = "tag__x";
      x.setAttribute("aria-label", "Hapus tag " + t);
      x.textContent = "×";
      x.addEventListener("click", function(){ removeTag(t); });
      chip.appendChild(x);
      wrap.appendChild(chip);
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
    renderTagEditor();
  }

  function addTag(raw){
    flushNote();
    var note = findNote(state.currentNoteId);
    if(!note) return;
    var clean = String(raw || "").replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, 20);
    if(!clean) return;
    note.tags = note.tags || [];
    var exists = note.tags.some(function(t){ return t.toLowerCase() === clean.toLowerCase(); });
    if(exists) return;
    note.tags.push(clean);
    note.updatedAt = Date.now();
    save();
    renderTagEditor(); renderTagFilter(); renderNoteList();
  }
  function removeTag(tag){
    flushNote();
    var note = findNote(state.currentNoteId);
    if(!note) return;
    note.tags = (note.tags || []).filter(function(t){ return t !== tag; });
    note.updatedAt = Date.now();
    save();
    renderTagEditor(); renderTagFilter(); renderNoteList();
  }

  $("tagForm").addEventListener("submit", function(e){
    e.preventDefault();
    addTag($("tagInput").value);
    $("tagInput").value = "";
  });
  $("tagInput").addEventListener("input", function(e){
    var v = e.target.value;
    if(v.indexOf(",") > -1){
      var parts = v.split(",");
      var rest = parts.pop();
      parts.forEach(addTag);
      e.target.value = rest;
    }
  });
  $("tagInput").addEventListener("keydown", function(e){
    if(e.key === "Backspace" && !e.target.value){
      var note = findNote(state.currentNoteId);
      if(note && note.tags && note.tags.length) removeTag(note.tags[note.tags.length - 1]);
    }
  });
  $("tagInput").addEventListener("blur", function(e){
    if(e.target.value.trim()){ addTag(e.target.value); e.target.value = ""; }
  });

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
    var note = { id: uid(), title: "Catatan baru", content: "", tags: [], updatedAt: Date.now() };
    DATA.notes.unshift(note);
    state.currentNoteId = note.id;
    state.tagFilter = ""; state.search = ""; $("searchInput").value = "";
    save(); renderTagFilter(); renderNoteList(); renderNoteEditor();
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
    save(); renderTagFilter(); renderNoteList(); renderNoteEditor();
  });

  $("searchInput").addEventListener("input", function(e){
    state.search = e.target.value;
    renderNoteList();
  });

  /* ---------- Keuangan ---------- */
  function renderPeriod(){
    var sel = $("finPeriod");
    var keys = {};
    keys[monthKey(Date.now())] = 1;
    DATA.expenses.forEach(function(e){ keys[monthKey(e.createdAt)] = 1; });
    if(state.finPeriod !== "all") keys[state.finPeriod] = 1;
    var html = '<option value="all">Semua waktu</option>';
    Object.keys(keys).sort().reverse().forEach(function(k){
      html += '<option value="' + k + '">' + esc(monthLabel(k)) + '</option>';
    });
    sel.innerHTML = html;
    sel.value = state.finPeriod;
  }

  function renderBudget(){
    var key = state.finPeriod === "all" ? monthKey(Date.now()) : state.finPeriod;
    var spent = 0;
    DATA.expenses.forEach(function(e){
      if(e.type !== "income" && monthKey(e.createdAt) === key) spent += e.amount;
    });
    $("budgetMonth").textContent = monthLabel(key);
    var b = DATA.budget || 0;
    var fill = $("budgetFill"), txt = $("budgetText"), inp = $("budgetInput");
    if(document.activeElement !== inp) inp.value = b ? b : "";
    if(!b){
      fill.style.width = "0%";
      fill.className = "bar__fill";
      txt.textContent = "Belum ada anggaran. Terpakai " + fmtRp(spent) + " bulan ini. Isi jumlah di bawah untuk mulai memantau.";
      return;
    }
    var pct = spent / b * 100;
    fill.style.width = Math.min(100, pct) + "%";
    fill.className = "bar__fill" + (pct >= 100 ? " over" : (pct >= 80 ? " warn" : ""));
    txt.textContent = pct >= 100
      ? "Terpakai " + fmtRp(spent) + " dari " + fmtRp(b) + " · melebihi " + fmtRp(spent - b)
      : "Terpakai " + fmtRp(spent) + " dari " + fmtRp(b) + " (" + Math.round(pct) + "%) · sisa " + fmtRp(b - spent);
  }

  function renderChart(list){
    var wrap = $("chartWrap");
    var totals = {}, total = 0;
    list.forEach(function(e){
      if(e.type !== "income"){
        var c = e.category || "Lainnya";
        totals[c] = (totals[c] || 0) + e.amount;
        total += e.amount;
      }
    });
    var cats = Object.keys(totals).sort(function(a,b){ return totals[b] - totals[a]; });
    if(!cats.length || total <= 0){
      wrap.innerHTML = '<div class="empty-hint">Belum ada pengeluaran di periode ini.</div>';
      return;
    }
    var R = 46, C = 2 * Math.PI * R, off = 0, segs = "", legend = "";
    cats.forEach(function(c){
      var color = CAT_COLORS[c] || "#8C8190";
      var len = totals[c] / total * C;
      segs += '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + color + '" stroke-width="16"' +
        ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 60 60)"></circle>';
      off += len;
      legend += '<li><span class="legend__dot" style="background:' + color + '"></span>' +
        '<span class="legend__name">' + esc(c) + '</span>' +
        '<span class="legend__val">' + fmtRp(totals[c]) + ' · ' + Math.round(totals[c] / total * 100) + '%</span></li>';
    });
    wrap.innerHTML =
      '<div class="chart">' +
        '<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Grafik pengeluaran per kategori">' +
          '<circle class="donut__track" cx="60" cy="60" r="' + R + '"></circle>' + segs +
          '<text class="donut__label" x="60" y="57" text-anchor="middle">Total</text>' +
          '<text class="donut__val" x="60" y="72" text-anchor="middle">' + fmtShort(total) + '</text>' +
        '</svg>' +
        '<ul class="legend">' + legend + '</ul>' +
      '</div>';
  }

  function renderFinance(){
    var all = DATA.expenses.slice().sort(function(a,b){ return b.createdAt - a.createdAt; });
    var balance = 0;
    all.forEach(function(e){ if(e.type === "income") balance += e.amount; else balance -= e.amount; });

    renderPeriod();
    var list = state.finPeriod === "all" ? all : all.filter(function(e){ return monthKey(e.createdAt) === state.finPeriod; });
    var income = 0, expense = 0;
    list.forEach(function(e){ if(e.type === "income") income += e.amount; else expense += e.amount; });
    $("statIncome").textContent = fmtRp(income);
    $("statExpense").textContent = fmtRp(expense);
    $("statBalance").textContent = fmtRp(balance);

    renderBudget();
    renderChart(list);

    var wrap = $("txList");
    wrap.innerHTML = "";
    if(!list.length){
      wrap.innerHTML = '<div class="empty-hint">' + (all.length
        ? "Tidak ada transaksi di periode ini."
        : "Belum ada transaksi. Tambahkan lewat form di atas.") + '</div>';
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

  $("finPeriod").addEventListener("change", function(e){
    state.finPeriod = e.target.value;
    renderFinance();
  });

  $("budgetForm").addEventListener("submit", function(e){
    e.preventDefault();
    var raw = $("budgetInput").value;
    var v = raw === "" ? 0 : parseFloat(raw);
    if(isNaN(v) || v < 0){ alert("Isi jumlah anggaran yang valid."); return; }
    DATA.budget = Math.round(v);
    save();
    $("budgetInput").blur();
    renderFinance();
  });

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

  /* ---------- Tugas ---------- */
  function todayStart(){
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function parseDue(s){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function dueInfo(t){
    var dd = parseDue(t.due);
    if(!dd) return { text: "Tanpa tenggat", cls: "" };
    var dateTxt = HARI_S[dd.getDay()] + ", " + dd.getDate() + " " + BULAN_S[dd.getMonth()];
    if(t.done) return { text: dateTxt, cls: "" };
    var diff = Math.round((dd.getTime() - todayStart().getTime()) / 864e5);
    if(diff < 0) return { text: "Terlambat " + (-diff) + " hari · " + dateTxt, cls: "overdue" };
    if(diff === 0) return { text: "Hari ini", cls: "today" };
    if(diff === 1) return { text: "Besok · " + dateTxt, cls: "soon" };
    if(diff <= 6) return { text: diff + " hari lagi · " + dateTxt, cls: "" };
    return { text: dateTxt, cls: "" };
  }
  function sortTasks(list){
    return list.slice().sort(function(a,b){
      if(a.done !== b.done) return a.done ? 1 : -1;
      var da = parseDue(a.due), db = parseDue(b.due);
      if(da && db && da.getTime() !== db.getTime()) return da - db;
      if(da && !db) return -1;
      if(!da && db) return 1;
      var pa = (PRIO[a.priority] || PRIO.med).w, pb = (PRIO[b.priority] || PRIO.med).w;
      if(pa !== pb) return pa - pb;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function renderTasks(){
    var all = DATA.tasks;
    var active = all.filter(function(t){ return !t.done; });
    var done = all.length - active.length;
    var overdue = active.filter(function(t){
      var dd = parseDue(t.due);
      return dd && dd.getTime() < todayStart().getTime();
    }).length;

    var fwrap = $("taskFilter");
    fwrap.innerHTML = "";
    [["all", "Semua (" + all.length + ")"], ["active", "Aktif (" + active.length + ")"], ["done", "Selesai (" + done + ")"]].forEach(function(p){
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.taskFilter === p[0] ? " active" : "");
      b.textContent = p[1];
      b.addEventListener("click", function(){ state.taskFilter = p[0]; renderTasks(); });
      fwrap.appendChild(b);
    });
    $("btnClearDone").hidden = done === 0;

    $("taskSummary").textContent = all.length
      ? active.length + " tugas aktif" + (overdue ? " · " + overdue + " terlambat" : "") + " · " + done + " selesai"
      : "";

    var list = sortTasks(all).filter(function(t){
      return state.taskFilter === "all" || (state.taskFilter === "active" ? !t.done : t.done);
    });
    var wrap = $("taskList");
    wrap.innerHTML = "";
    if(!list.length){
      wrap.innerHTML = '<div class="empty-hint">' + (all.length ? "Tidak ada tugas di filter ini." : "Belum ada tugas. Tambahkan lewat form di atas.") + '</div>';
      return;
    }
    list.forEach(function(t){
      var pr = PRIO[t.priority] || PRIO.med;
      var di = dueInfo(t);
      var row = document.createElement("div");
      row.className = "task-row glass-row" + (t.done ? " done" : "");
      row.innerHTML =
        '<button type="button" class="task-check' + (t.done ? " on" : "") + '" role="checkbox" aria-checked="' + (t.done ? "true" : "false") + '" aria-label="Tandai selesai"></button>' +
        '<div class="task-main">' +
          '<p class="task-title">' + esc(t.title) + '</p>' +
          '<div class="task-meta">' +
            '<span class="due ' + di.cls + '">' + esc(di.text) + '</span>' +
            '<span class="prio" style="color:' + pr.color + '">' + pr.label + '</span>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="tx-row__del" title="Hapus" aria-label="Hapus tugas">✕</button>';
      row.querySelector(".task-check").addEventListener("click", function(){
        t.done = !t.done;
        save(); renderTasks();
      });
      row.querySelector(".tx-row__del").addEventListener("click", function(){
        DATA.tasks = DATA.tasks.filter(function(x){ return x.id !== t.id; });
        save(); renderTasks();
      });
      wrap.appendChild(row);
    });
  }

  $("taskForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target, els = f.elements;
    var title = els["title"].value.trim();
    if(!title){ alert("Isi nama tugas."); return; }
    var due = els["due"].value;
    DATA.tasks.push({
      id: uid(),
      title: title,
      priority: PRIO[els["priority"].value] ? els["priority"].value : "med",
      due: parseDue(due) ? due : "",
      done: false,
      createdAt: Date.now()
    });
    save();
    f.reset();
    els["priority"].value = "med";
    renderTasks();
  });

  $("btnClearDone").addEventListener("click", function(){
    var n = DATA.tasks.filter(function(t){ return t.done; }).length;
    if(!n) return;
    if(!confirm("Hapus " + n + " tugas yang sudah selesai?")) return;
    DATA.tasks = DATA.tasks.filter(function(t){ return !t.done; });
    save(); renderTasks();
  });

  /* ---------- Fokus (Pomodoro) ---------- */
  var RING_C = 2 * Math.PI * 88;
  var P = { mode: "work", running: false, endAt: 0, remaining: 0 };
  var audioCtx = null;

  function pomoTotal(){ return (P.mode === "work" ? DATA.pomo.work : DATA.pomo.brk) * 60000; }
  function pomoSave(){
    try{ localStorage.setItem(PKEY, JSON.stringify({ mode: P.mode, running: P.running, endAt: P.endAt, remaining: P.remaining })); }
    catch(e){}
  }
  function pomoLoad(){
    P.mode = "work"; P.running = false; P.endAt = 0;
    try{
      var s = JSON.parse(localStorage.getItem(PKEY));
      if(s && (s.mode === "work" || s.mode === "break")){
        P.mode = s.mode;
        P.running = !!s.running;
        P.endAt = +s.endAt || 0;
        P.remaining = +s.remaining > 0 ? +s.remaining : pomoTotal();
      }
    }catch(e){}
    if(!(P.remaining > 0)) P.remaining = pomoTotal();
    if(P.remaining > pomoTotal()) P.remaining = pomoTotal();
    /* Jika aplikasi ditutup lama saat timer berjalan, anggap timer dibatalkan */
    if(P.running && P.endAt < Date.now() - 5 * 60000){
      P.running = false;
      P.remaining = pomoTotal();
    }
  }
  function pomoReset(){
    P.mode = "work"; P.running = false; P.endAt = 0; P.remaining = pomoTotal();
    pomoSave();
  }

  function fmtMMSS(ms){
    var s = Math.max(0, Math.ceil(ms / 1000));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  }

  function initAudio(){
    try{
      var AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      if(!audioCtx) audioCtx = new AC();
      if(audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
    }catch(e){}
  }
  function beep(){
    try{
      if(!audioCtx) return;
      [0, 0.28, 0.56].forEach(function(t){
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.15;
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + t);
        o.stop(audioCtx.currentTime + t + 0.16);
      });
    }catch(e){}
  }
  function notifyUser(title, body){
    try{ if(navigator.vibrate) navigator.vibrate([200, 100, 200]); }catch(e){}
    beep();
    try{
      if(!("Notification" in window) || Notification.permission !== "granted") return;
      if(navigator.serviceWorker && navigator.serviceWorker.getRegistration){
        navigator.serviceWorker.getRegistration().then(function(reg){
          if(reg && reg.showNotification) reg.showNotification(title, { body: body, icon: "icons/icon-192.png", tag: "pomodoro" });
          else new Notification(title, { body: body });
        }).catch(function(){});
      }else{
        new Notification(title, { body: body });
      }
    }catch(e){}
  }

  function completePhase(alertUser){
    var was = P.mode;
    if(was === "work"){
      DATA.pomo.log.push({
        id: uid(),
        ts: Date.now(),
        minutes: DATA.pomo.work,
        label: $("focusLabel").value.trim().slice(0, 60)
      });
      DATA.pomo.log = DATA.pomo.log.slice(-500);
      save();
    }
    P.mode = was === "work" ? "break" : "work";
    P.running = false;
    P.endAt = 0;
    P.remaining = pomoTotal();
    pomoSave();
    if(alertUser){
      notifyUser(was === "work" ? "Sesi fokus selesai 🎉" : "Istirahat selesai",
                 was === "work" ? "Waktunya istirahat sebentar." : "Yuk lanjut fokus lagi.");
    }
    renderFocus();
  }

  function pomoTick(){
    if(P.running){
      var left = P.endAt - Date.now();
      if(left <= 0){ completePhase(true); return; }
      P.remaining = left;
    }
    renderFocusTime();
  }

  function renderFocusTime(){
    var total = pomoTotal();
    var left = P.running ? Math.max(0, P.endAt - Date.now()) : P.remaining;
    $("focusTime").textContent = fmtMMSS(left);
    var f = total ? Math.min(1, left / total) : 0;
    var ring = $("focusRing");
    ring.setAttribute("stroke-dasharray", RING_C.toFixed(2));
    ring.setAttribute("stroke-dashoffset", (RING_C * (1 - f)).toFixed(2));
    ring.setAttribute("class", "focus-ring__bar" + (P.mode === "break" ? " break" : ""));
    var modeTxt = P.mode === "work" ? "Fokus" : "Istirahat";
    $("focusMode").textContent = modeTxt;
    $("btnFocusStart").textContent = P.running ? "Jeda" : (left < total ? "Lanjut" : "Mulai");
    $("focusCard").classList.toggle("is-running", P.running);
    document.title = P.running ? fmtMMSS(left) + " · " + modeTxt : BASE_TITLE;
  }

  function renderFocus(){
    var wi = $("focusWork"), bi = $("focusBreak");
    if(document.activeElement !== wi) wi.value = DATA.pomo.work;
    if(document.activeElement !== bi) bi.value = DATA.pomo.brk;

    var tk = todayStart().getTime();
    var today = DATA.pomo.log.filter(function(x){ return x.ts >= tk; });
    var mins = 0;
    today.forEach(function(x){ mins += +x.minutes || 0; });
    $("focusStatToday").textContent = today.length;
    $("focusStatMinutes").textContent = mins;
    $("focusStatTotal").textContent = DATA.pomo.log.length;
    $("btnFocusClear").hidden = DATA.pomo.log.length === 0;

    var wrap = $("focusLog");
    wrap.innerHTML = "";
    if(!today.length){
      wrap.innerHTML = '<div class="empty-hint">Belum ada sesi fokus hari ini.</div>';
    }else{
      today.slice().reverse().slice(0, 8).forEach(function(x){
        var d = new Date(x.ts);
        var row = document.createElement("div");
        row.className = "tx-row";
        row.innerHTML =
          '<span class="tx-row__dot" style="background:var(--accent)"></span>' +
          '<div class="tx-row__info">' +
            '<p class="tx-row__desc">' + esc(x.label || "Sesi fokus") + '</p>' +
            '<span class="tx-row__sub">' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</span>' +
          '</div>' +
          '<span class="tx-row__amt in">' + (+x.minutes || 0) + ' mnt</span>';
        wrap.appendChild(row);
      });
    }
    renderFocusTime();
  }

  $("btnFocusStart").addEventListener("click", function(){
    initAudio();
    if(P.running){
      P.remaining = Math.max(0, P.endAt - Date.now());
      P.running = false;
    }else{
      if(!(P.remaining > 0)) P.remaining = pomoTotal();
      P.endAt = Date.now() + P.remaining;
      P.running = true;
      try{
        if("Notification" in window && Notification.permission === "default"){
          var r = Notification.requestPermission();
          if(r && r.catch) r.catch(function(){});
        }
      }catch(e){}
    }
    pomoSave();
    renderFocusTime();
  });
  $("btnFocusReset").addEventListener("click", function(){
    P.running = false; P.endAt = 0; P.remaining = pomoTotal();
    pomoSave();
    renderFocusTime();
  });
  $("btnFocusSkip").addEventListener("click", function(){
    P.mode = P.mode === "work" ? "break" : "work";
    P.running = false; P.endAt = 0; P.remaining = pomoTotal();
    pomoSave();
    renderFocusTime();
  });
  function onPomoSetting(){
    DATA.pomo.work = clampInt($("focusWork").value, 1, 180, DATA.pomo.work);
    DATA.pomo.brk = clampInt($("focusBreak").value, 1, 60, DATA.pomo.brk);
    save();
    if(!P.running){ P.remaining = pomoTotal(); pomoSave(); }
    $("focusWork").value = DATA.pomo.work;
    $("focusBreak").value = DATA.pomo.brk;
    renderFocusTime();
  }
  $("focusWork").addEventListener("change", onPomoSetting);
  $("focusBreak").addEventListener("change", onPomoSetting);
  $("btnFocusClear").addEventListener("click", function(){
    if(!confirm("Hapus semua riwayat sesi fokus?")) return;
    DATA.pomo.log = [];
    save(); renderFocus();
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
    var pop = $("settingsPop");
    var hd = document.querySelector("header");
    /* Posisikan popover tepat di bawah header (tinggi header berbeda di HP & desktop) */
    pop.style.top = (hd.offsetTop + hd.offsetHeight + 8) + "px";
    pop.classList.toggle("open");
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

  function renderAll(){
    applySettings();
    renderTagFilter(); renderNoteList(); renderNoteEditor();
    renderFinance(); renderTasks(); renderFocus(); renderSettingsPop();
  }

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
        state.tagFilter = "";
        pomoReset();
        renderAll();
        alert("Data berhasil diimpor.");
      }catch(err){
        alert("Gagal mengimpor: file tidak valid.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  $("btnReset").addEventListener("click", function(){
    if(!confirm("Semua catatan, transaksi, tugas, dan riwayat fokus akan dihapus permanen. Lanjutkan?")) return;
    if(pendingTimer){ clearTimeout(pendingTimer); pendingTimer = null; }
    pendingId = null;
    DATA = defaultData();
    save();
    state.currentNoteId = DATA.notes[0] ? DATA.notes[0].id : null;
    state.tagFilter = "";
    pomoReset();
    renderAll();
  });

  /* ---------- Simpan saat halaman ditutup / disembunyikan ---------- */
  document.addEventListener("visibilitychange", function(){
    if(document.hidden) flushNote(); else { tickClock(); pomoTick(); }
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
  pomoLoad();
  applySettings();
  renderTagFilter();
  renderNoteList();
  renderNoteEditor();
  renderFinance();
  renderTasks();
  renderFocus();
  scheduleClock();
  setInterval(pomoTick, 250);
})();
