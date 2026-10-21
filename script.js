(function(){
  "use strict";
  var KEY = "catatanku_simple_v1";

  var ACCENTS = ["#7E6585","#C27B5F","#5F8F88","#B59A5E","#A5748A","#7C8AA8"];
  var CAT_COLORS = {Makanan:"#C27B5F",Transportasi:"#5F8F88",Kuliah:"#7E6585",Belanja:"#B59A5E",Hiburan:"#A5748A",Lainnya:"#7C8AA8"};

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  function defaultData(){
    return {
      notes: [
        { id: uid(), title: "HELLO FADIL!!!", content: "Ketik disini", updatedAt: Date.now() }
      ],
      expenses: [],
      settings: { accent: "#7E6585", text: "#3B3340", theme: "light" }
    };
  }

  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      if(!raw) return defaultData();
      var d = JSON.parse(raw);
      var def = defaultData();
      return {
        notes: Array.isArray(d.notes) ? d.notes : def.notes,
        expenses: Array.isArray(d.expenses) ? d.expenses : def.expenses,
        settings: Object.assign(def.settings, d.settings || {})
      };
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
    return sign + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
  }
  function fmtDate(ts){
    return new Date(ts).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});
  }
  function esc(s){
    return (s||"").replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function debounce(fn, ms){
    var t;
    return function(){
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function(){ fn.apply(null, args); }, ms);
    };
  }

  /* ---------- Tabs ---------- */
  document.querySelectorAll(".tab-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      state.tab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach(function(b){ b.classList.toggle("active", b === btn); });
      document.getElementById("panel-notes").classList.toggle("active", state.tab === "notes");
      document.getElementById("panel-finance").classList.toggle("active", state.tab === "finance");
      if(state.tab === "finance") renderFinance();
    });
  });

  /* ---------- Catatan ---------- */
  function visibleNotes(){
    var list = DATA.notes.slice();
    if(state.search.trim()){
      var q = state.search.trim().toLowerCase();
      list = list.filter(function(n){
        return n.title.toLowerCase().indexOf(q) > -1 || n.content.toLowerCase().indexOf(q) > -1;
      });
    }
    return list.sort(function(a,b){ return b.updatedAt - a.updatedAt; });
  }

  function renderNoteList(){
    var wrap = document.getElementById("noteList");
    var list = visibleNotes();
    wrap.innerHTML = "";
    if(!list.length){
      wrap.innerHTML = '<div class="empty-hint">Belum ada catatan.</div>';
      return;
    }
    list.forEach(function(n){
      var item = document.createElement("button");
      item.className = "note-item" + (n.id === state.currentNoteId ? " active" : "");
      item.innerHTML =
        '<p class="note-item__title">' + esc(n.title || "Tanpa judul") + '</p>' +
        '<p class="note-item__snip">' + esc(n.content).slice(0,60) + '</p>';
      item.addEventListener("click", function(){
        state.currentNoteId = n.id;
        renderNoteList();
        renderNoteEditor();
      });
      wrap.appendChild(item);
    });
  }

  function renderNoteEditor(){
    var note = DATA.notes.find(function(n){ return n.id === state.currentNoteId; });
    var empty = document.getElementById("noteEmpty");
    var form = document.getElementById("noteForm");
    if(!note){ empty.style.display = "block"; form.style.display = "none"; return; }
    empty.style.display = "none"; form.style.display = "flex";
    document.getElementById("noteTitle").value = note.title;
    document.getElementById("noteContent").value = note.content;
    document.getElementById("noteMeta").textContent = "Diperbarui " + fmtDate(note.updatedAt);
  }

  var autosaveNote = debounce(function(){
    var note = DATA.notes.find(function(n){ return n.id === state.currentNoteId; });
    if(!note) return;
    note.title = document.getElementById("noteTitle").value || "Tanpa judul";
    note.content = document.getElementById("noteContent").value;
    note.updatedAt = Date.now();
    save();
    document.getElementById("noteMeta").textContent = "Tersimpan · " + fmtDate(note.updatedAt);
    renderNoteList();
  }, 400);

  document.getElementById("noteTitle").addEventListener("input", autosaveNote);
  document.getElementById("noteContent").addEventListener("input", autosaveNote);

  document.getElementById("btnNewNote").addEventListener("click", function(){
    var note = { id: uid(), title: "Catatan baru", content: "", updatedAt: Date.now() };
    DATA.notes.unshift(note);
    state.currentNoteId = note.id;
    save(); renderNoteList(); renderNoteEditor();
    document.getElementById("noteTitle").focus();
    document.getElementById("noteTitle").select();
  });

  document.getElementById("btnDeleteNote").addEventListener("click", function(){
    var note = DATA.notes.find(function(n){ return n.id === state.currentNoteId; });
    if(!note) return;
    if(!confirm('Hapus catatan "' + note.title + '"?')) return;
    DATA.notes = DATA.notes.filter(function(n){ return n.id !== note.id; });
    state.currentNoteId = null;
    save(); renderNoteList(); renderNoteEditor();
  });

  document.getElementById("searchInput").addEventListener("input", function(e){
    state.search = e.target.value;
    renderNoteList();
  });

  /* ---------- Keuangan ---------- */
  function renderFinance(){
    var list = DATA.expenses.slice().sort(function(a,b){ return b.createdAt - a.createdAt; });
    var income = 0, expense = 0;
    list.forEach(function(e){ if(e.type === "income") income += e.amount; else expense += e.amount; });
    document.getElementById("statIncome").textContent = fmtRp(income);
    document.getElementById("statExpense").textContent = fmtRp(expense);
    document.getElementById("statBalance").textContent = fmtRp(income - expense);

    var wrap = document.getElementById("txList");
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
        '<button class="tx-row__del" title="Hapus">✕</button>';
      row.querySelector(".tx-row__del").addEventListener("click", function(){
        DATA.expenses = DATA.expenses.filter(function(x){ return x.id !== e.id; });
        save(); renderFinance();
      });
      wrap.appendChild(row);
    });
  }

  document.getElementById("txForm").addEventListener("submit", function(e){
    e.preventDefault();
    var f = e.target;
    var amount = parseFloat(f.amount.value);
    if(!amount || amount <= 0){ alert("Isi jumlah yang valid."); return; }
    DATA.expenses.push({
      id: uid(),
      type: f.type.value,
      description: f.desc.value.trim(),
      category: f.category.value,
      amount: amount,
      createdAt: Date.now()
    });
    save();
    f.reset();
    renderFinance();
  });

  /* ---------- Pengaturan ---------- */
  function applySettings(){
    var s = DATA.settings;
    document.documentElement.style.setProperty("--accent", s.accent);
    document.documentElement.style.setProperty("--text", s.text);
    document.documentElement.setAttribute("data-theme", s.theme);
  }

  function renderSettingsPop(){
    var s = DATA.settings;
    var swatchWrap = document.getElementById("accentSwatches");
    swatchWrap.innerHTML = "";
    ACCENTS.forEach(function(hex){
      var sw = document.createElement("button");
      sw.className = "swatch" + (hex.toLowerCase() === s.accent.toLowerCase() ? " active" : "");
      sw.style.background = hex;
      sw.addEventListener("click", function(){
        s.accent = hex; save(); applySettings(); renderSettingsPop();
      });
      swatchWrap.appendChild(sw);
    });
    document.getElementById("accentCustom").value = s.accent;
    document.getElementById("textCustom").value = s.text;
    document.querySelectorAll(".theme-switch button").forEach(function(b){
      b.classList.toggle("active", b.dataset.theme === s.theme);
    });
  }

  document.getElementById("btnSettings").addEventListener("click", function(){
    document.getElementById("settingsPop").classList.toggle("open");
    renderSettingsPop();
  });
  document.addEventListener("click", function(e){
    var pop = document.getElementById("settingsPop");
    if(pop.classList.contains("open") && !pop.contains(e.target) && e.target.id !== "btnSettings"){
      pop.classList.remove("open");
    }
  });

  document.getElementById("accentCustom").addEventListener("input", function(e){
    DATA.settings.accent = e.target.value; save(); applySettings(); renderSettingsPop();
  });
  document.getElementById("textCustom").addEventListener("input", function(e){
    DATA.settings.text = e.target.value; save(); applySettings();
  });
  document.querySelectorAll(".theme-switch button").forEach(function(btn){
    btn.addEventListener("click", function(){
      DATA.settings.theme = btn.dataset.theme; save(); applySettings(); renderSettingsPop();
    });
  });

  document.getElementById("btnExport").addEventListener("click", function(){
    var blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "catatanku-cadangan.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  document.getElementById("importFile").addEventListener("change", function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var parsed = JSON.parse(reader.result);
        var def = defaultData();
        DATA = {
          notes: Array.isArray(parsed.notes) ? parsed.notes : def.notes,
          expenses: Array.isArray(parsed.expenses) ? parsed.expenses : def.expenses,
          settings: Object.assign(def.settings, parsed.settings || {})
        };
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

  document.getElementById("btnReset").addEventListener("click", function(){
    if(!confirm("Semua catatan dan transaksi akan dihapus permanen. Lanjutkan?")) return;
    DATA = defaultData();
    save();
    state.currentNoteId = DATA.notes[0] ? DATA.notes[0].id : null;
    applySettings(); renderNoteList(); renderNoteEditor(); renderFinance(); renderSettingsPop();
  });

  /* ---------- Init ---------- */
  applySettings();
  renderNoteList();
  renderNoteEditor();
  renderFinance();
})();
