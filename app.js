/* ---------------- Firebase 初始化 ---------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCMQ1NcIcR-lbBX3xVRTEg_uAATp7SJ3o4",
  authDomain: "chem-inventory-39b3f.firebaseapp.com",
  databaseURL: "https://chem-inventory-39b3f-default-rtdb.firebaseio.com",
  projectId: "chem-inventory-39b3f",
  storageBucket: "chem-inventory-39b3f.appspot.com",
  messagingSenderId: "285037545391",
  appId: "1:285037545391:web:f4b29e884e065da274915a",
  measurementId: "G-RVJPNXF6MF"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ---------------- Firebase 封装 ---------------- */
async function readData(path) {
  const snapshot = await get(ref(db, path));
  return snapshot.exists() ? snapshot.val() : null;
}
async function writeData(path, data) { await set(ref(db, path), data); }
async function updateData(path, data) { await update(ref(db, path), data); }
async function deleteData(path) { await remove(ref(db, path)); }

/* ---------------- 数据路径 ---------------- */
const PATH = {
  reagents: "Reagents",
  reagentsHeaders: "ReagentsHeaders",
  groups: "Groups",
  discontinued: "Discontinued",
  discontinuedHeaders: "DiscontinuedHeaders",
  history: "History",
  historyColCount: "HistoryColCount"
};

/* ---------------- 页面切换 ---------------- */
function showPage(id, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(id);
  if (page) page.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  if (el) el.classList.add("active");
}

/* ---------------- 图片预览 ---------------- */
function previewImage(url) {
  const overlay = document.getElementById("imgPreviewOverlay");
  const img = document.getElementById("imgPreview");
  img.src = url;
  overlay.style.display = "flex";
  overlay.onclick = () => overlay.style.display = "none";
}

/* ---------------- 列宽拖拽 ---------------- */
function enableTableColumnResize(selector) {
  const ths = document.querySelectorAll(`${selector} thead th`);

  ths.forEach((th, index) => {
    if (th.querySelector(".col-resizer")) return;

    const resizer = document.createElement("div");
    resizer.className = "col-resizer";
    th.style.position = "relative";
    th.appendChild(resizer);

    let startX, startWidth;

    resizer.addEventListener("mousedown", (e) => {
      startX = e.pageX;
      startWidth = th.offsetWidth;

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    function onMove(e) {
      const newWidth = startWidth + (e.pageX - startX);
      th.style.width = newWidth + "px";

      document.querySelectorAll(`${selector} tbody tr`).forEach(tr => {
        if (tr.children[index]) tr.children[index].style.width = newWidth + "px";
      });
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
  });
}

/* ---------------- 行高拖拽 ---------------- */
function enableStableRowResize(selector) {
  const table = document.querySelector(selector);
  if (!table) return;

  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const trs = tbody.querySelectorAll("tr");

  trs.forEach(tr => {
    if (tr.dataset.hasRowResizer) return;
    tr.dataset.hasRowResizer = "1";

    tr.style.position = "relative";

    const resizer = document.createElement("div");
    resizer.className = "row-resizer";
    resizer.style.position = "absolute";
    resizer.style.left = "0";
    resizer.style.width = "100%";
    resizer.style.bottom = "0";
    resizer.style.height = "6px";
    resizer.style.cursor = "ns-resize";
    resizer.style.background = "transparent";
    resizer.style.zIndex = "999";

    tr.appendChild(resizer);

    let startY = 0;
    let startHeight = 0;

    resizer.addEventListener("mousedown", function (e) {
      e.preventDefault();
      startY = e.clientY;
      startHeight = tr.offsetHeight;

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    function onMove(e) {
      const delta = e.clientY - startY;
      const newHeight = Math.max(24, startHeight + delta);
      tr.style.height = newHeight + "px";
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
  });
}

/* ---------------- 到期时间解析 ---------------- */
function parseExpireDate(str) {
  if (!str) return null;
  if (str.trim().toUpperCase() === "NA") return null;

  str = str.replace(/过期|到期|时间|：|:|\(|\)|（|）/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (/^\d{4}年\d{1,2}月\d{1,2}日$/.test(str)) {
    const y = str.match(/(\d{4})年/)[1];
    const m = str.match(/(\d{1,2})月/)[1];
    const d = str.match(/(\d{1,2})日/)[1];
    return new Date(`${y}-${m}-${d}`);
  }

  if (/^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}$/.test(str)) {
    return new Date(str.replace(/[\/.]/g, "-"));
  }

  if (!isNaN(Date.parse(str))) {
    return new Date(str);
  }

  return null;
}

/* ---------------- 化学试剂统计 ---------------- */
async function updateStats() {
  const data = await readData(PATH.reagents);
  if (!data) {
    document.getElementById("totalCount").textContent = 0;
    document.getElementById("nearExpireCount").textContent = 0;
    document.getElementById("expiredCount").textContent = 0;
    document.getElementById("nearExpireList").innerHTML = "";
    document.getElementById("expiredList").innerHTML = "";
    return;
  }

  let total = 0;
  let nearExpire = 0;
  let expired = 0;

  const nearExpireList = [];
  const expiredList = [];

  const now = new Date();
  const threeMonths = 90;

  Object.values(data).forEach(row => {
    total++;

    const name = row.col1 ?? "(未命名)";
    const expireDateStr = row.col6;
    if (!expireDateStr) return;

    const expireDate = parseExpireDate(expireDateStr);
    if (!expireDate) return;

    const diffDays = (expireDate - now) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) {
      expired++;
      expiredList.push(`${name}（${expireDateStr}）`);
    } else if (diffDays <= threeMonths) {
      nearExpire++;
      nearExpireList.push(`${name}（${expireDateStr}）`);
    }
  });

  document.getElementById("totalCount").textContent = total;
  document.getElementById("nearExpireCount").textContent = nearExpire;
  document.getElementById("expiredCount").textContent = expired;

  const nearList = document.getElementById("nearExpireList");
  const expList = document.getElementById("expiredList");

  nearList.innerHTML = "";
  expList.innerHTML = "";

  nearExpireList.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    nearList.appendChild(li);
  });

  expiredList.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    expList.appendChild(li);
  });
}

/* ---------------- 试剂管理 ---------------- */
let currentRowId = null;
let currentColumnIndex = null;
let columnManagerRendered = false;

async function loadReagents() {
  const data = await readData(PATH.reagents);
  const tbody = document.querySelector("#reagentTable tbody");
  tbody.innerHTML = "";

  const ths = document.querySelectorAll("#reagentTable thead th");
  const headers = Array.from(ths).map((_, index) => `col${index}`);

  if (!data) {
    renderColumnManager();
    updateStats();
    enableTableColumnResize("#reagentTable");
    enableStableRowResize("#reagentTable");
    return;
  }

  Object.keys(data).forEach((id, rowIndex) => {
    const row = data[id];
    const tr = document.createElement("tr");
    tr.dataset.id = id;

    headers.forEach((key, index) => {
      const td = document.createElement("td");

      if (index === 0) {
        td.contentEditable = false;

        const spanText = document.createElement("span");
        spanText.textContent = rowIndex + 1;
        td.appendChild(spanText);

        const spanMenu = document.createElement("span");
        spanMenu.textContent = "▼";
        spanMenu.className = "row-menu-btn";
        spanMenu.style.marginLeft = "8px";
        spanMenu.onclick = (e) => openRowMenu(e, id);
        td.appendChild(spanMenu);
      } else if (index === 7) {
        const btn = document.createElement("button");
        btn.textContent = "上传";
        btn.className = "btn";
        btn.onclick = () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "*/*";
          input.onchange = (e) => uploadPhoto(id, e.target.files[0]);
          input.click();
        };
        td.appendChild(btn);

        const val = row[key];
        if (val) {
          if (val.startsWith("data:image")) {
            const img = document.createElement("img");
            img.src = val;
            img.width = 60;
            img.style.marginLeft = "8px";
            img.style.cursor = "pointer";
            img.onclick = () => previewImage(val);
            td.appendChild(img);
          } else {
            const link = document.createElement("a");
            link.href = val;
            link.textContent = "附件";
            link.download = row.filename || "附件";
            link.style.marginLeft = "8px";
            td.appendChild(link);
          }

          const delBtn = document.createElement("button");
          delBtn.textContent = "删除";
          delBtn.style.marginLeft = "8px";
          delBtn.onclick = () => deletePhoto(delBtn);
          td.appendChild(delBtn);
        }
      } else {
        td.contentEditable = true;
        td.textContent = row[key] ?? "";
        td.oninput = () => saveReagentRow(id);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  renderColumnManager();
  updateStats();
  enableTableColumnResize("#reagentTable");
  enableStableRowResize("#reagentTable");
}

async function saveReagentRow(id) {
  const tr = document.querySelector(`#reagentTable tbody tr[data-id="${id}"]`);
  const tds = tr.querySelectorAll("td");
  const rowData = {};

  tds.forEach((td, index) => {
    if (index === 0 || index === 7) return;
    rowData[`col${index}`] = td.textContent.trim();
  });

  await updateData(`${PATH.reagents}/${id}`, rowData);
}

async function addReagentRow() {
  const id = Date.now();
  const theadRow = document.querySelector("#reagentTable thead tr");
  const colCount = theadRow.children.length;
  const rowData = {};

  for (let i = 0; i < colCount; i++) {
    rowData[`col${i}`] = "";
  }

  await writeData(`${PATH.reagents}/${id}`, rowData);
  await loadReagents();
}

async function deleteReagent(id) {
  await deleteData(`${PATH.reagents}/${id}`);
  await loadReagents();
}

async function uploadPhoto(id, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function (e) {
    const base64 = e.target.result;
    await updateData(`${PATH.reagents}/${id}`, {
      col7: base64,
      filename: file.name
    });
    await loadReagents();
  };
  reader.readAsDataURL(file);
}

function deletePhoto(btn) {
  const td = btn.closest("td");
  const tr = btn.closest("tr");
  const id = tr.dataset.id;

  const fileElem = td.querySelector("img, a");
  if (!fileElem) return;

  fileElem.remove();
  btn.remove();

  updateData(`${PATH.reagents}/${id}`, { col7: "", filename: "" });
}

function openColumnMenu(event, arg) {
  const headerRow = document.querySelector("#reagentTable thead tr");

  if (typeof arg === "number") {
    currentColumnIndex = arg;
  } else {
    const thElem = arg.closest("th");
    currentColumnIndex = Array.from(headerRow.children).indexOf(thElem);
  }

  const menu = document.getElementById("colMenu");
  menu.style.display = "block";
  menu.style.left = event.pageX + "px";
  menu.style.top = event.pageY + "px";
}

async function deleteColumnByIndex() {
  const index = currentColumnIndex;
  if (index == null) return;

  const table = document.getElementById("reagentTable");
  const theadRow = table.querySelector("thead tr");
  const tbodyRows = table.querySelectorAll("tbody tr");

  theadRow.children[index].remove();

  tbodyRows.forEach(tr => {
    if (tr.children[index]) tr.children[index].remove();
  });

  const data = await readData(PATH.reagents);
  const updates = {};

  Object.keys(data || {}).forEach(id => {
    const tr = document.querySelector(`#reagentTable tbody tr[data-id="${id}"]`);
    if (!tr) return;
    const tds = tr.children;

    const newRow = {};
    for (let i = 0; i < tds.length; i++) {
      if (i === 0 || i === 7) continue;
      newRow[`col${i}`] = tds[i].textContent.trim();
    }

    updates[id] = newRow;
  });

  await updateData(PATH.reagents, updates);

  document.getElementById("colMenu").style.display = "none";
  currentColumnIndex = null;

  await loadReagents();
}

function renderColumnManager() {
  if (columnManagerRendered) return;
  columnManagerRendered = true;

  const ths = document.querySelectorAll("#reagentTable thead th");
  const manager = document.getElementById("columnManager");
  if (!manager) return;

  manager.innerHTML = "";

  ths.forEach((th, index) => {
    const label = document.createElement("label");
    label.style.marginRight = "10px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.onchange = () => toggleColumn(index, checkbox.checked);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(th.textContent.trim()));
    manager.appendChild(label);
  });
}

function toggleColumn(index, show) {
  const ths = document.querySelectorAll("#reagentTable thead th");
  const trs = document.querySelectorAll("#reagentTable tbody tr");

  if (ths[index]) ths[index].style.display = show ? "" : "none";
  trs.forEach(tr => {
    if (tr.children[index]) tr.children[index].style.display = show ? "" : "none";
  });
}

async function addColumn(tableId) {
  const table = document.getElementById(tableId);
  const colName = prompt("请输入新列名称：");
  if (!colName) return;

  const theadRow = table.querySelector("thead tr");
  const colIndex = theadRow.children.length;

  const th = document.createElement("th");
  th.innerHTML = `${colName} <span class="col-menu-btn">▼</span>`;
  th.querySelector(".col-menu-btn").onclick = (e) => openColumnMenu(e, th);
  theadRow.appendChild(th);

  const tbodyRows = table.querySelectorAll("tbody tr");
  for (let tr of tbodyRows) {
    const id = tr.dataset.id;

    const td = document.createElement("td");
    td.contentEditable = true;
    td.textContent = "";
    td.oninput = () => saveReagentRow(id);
    tr.appendChild(td);

    await updateData(`${PATH.reagents}/${id}`, {
      [`col${colIndex}`]: ""
    });
  }

  enableTableColumnResize("#reagentTable");
  enableStableRowResize("#reagentTable");
}

function openRowMenu(event, rowId) {
  currentRowId = rowId;
  const menu = document.getElementById("rowMenu");
  menu.style.display = "block";
  menu.style.left = event.pageX + "px";
  menu.style.top = event.pageY + "px";
}

async function deleteRowById() {
  if (!currentRowId) return;
  await deleteData(`${PATH.reagents}/${currentRowId}`);
  document.getElementById("rowMenu").style.display = "none";
  currentRowId = null;
  await loadReagents();
}

/* ---------------- 搜索 ---------------- */
function setupSearch() {
  const searchInput = document.getElementById("searchBox");
  if (!searchInput) return;

  searchInput.oninput = function () {
    const keyword = this.value.trim().toLowerCase();
    const trs = document.querySelectorAll("#reagentTable tbody tr");
    trs.forEach(tr => {
      const text = tr.textContent.toLowerCase();
      tr.style.display = text.includes(keyword) ? "" : "none";
    });
  };
}

/* ---------------- 粘贴多行 ---------------- */
document.addEventListener("paste", function (e) {
  const active = document.activeElement;
  if (!active || active.tagName !== "TD" || !active.closest("#reagentTable")) return;

  e.preventDefault();

  const text = (e.clipboardData || window.clipboardData).getData("text");
  const rows = text.split(/\r?\n/).filter(r => r.trim() !== "");

  let startRow = active.parentElement.rowIndex - 1;
  let startCol = active.cellIndex;

  rows.forEach((rowText, rIndex) => {
    const cols = rowText.split(/\t/);
    const tr = document.querySelector(`#reagentTable tbody tr:nth-child(${startRow + rIndex + 1})`);
    if (!tr) return;

    cols.forEach((colText, cIndex) => {
      const td = tr.children[startCol + cIndex];
      if (!td) return;
      td.textContent = colText;
      const id = tr.dataset.id;
      saveReagentRow(id);
    });
  });
});

/* ---------------- 停产试剂模块 ---------------- */
let DIS_HEADERS = [
  "序号",
  "化学试剂名称",
  "厂商",
  "evidence",
  "停产日期",
  "备注"
];
let currentDisColIndex = null;

async function loadDiscontinued() {
  const headersFromDb = await readData(PATH.discontinuedHeaders);
  if (headersFromDb && Array.isArray(headersFromDb)) {
    DIS_HEADERS = headersFromDb;
  }

  const data = await readData(PATH.discontinued);
  const tbody = document.querySelector("#disTable tbody");
  tbody.innerHTML = "";

  if (!data) {
    enableTableColumnResize("#disTable");
    enableStableRowResize("#disTable");
    return;
  }

  Object.keys(data).forEach((id, rowIndex) => {
    const row = data[id];
    const tr = document.createElement("tr");
    tr.dataset.id = id;

    DIS_HEADERS.forEach((header, index) => {
      const td = document.createElement("td");

      if (index === 0) {
        td.contentEditable = false;

        const spanText = document.createElement("span");
        spanText.textContent = rowIndex + 1;
        td.appendChild(spanText);

        const spanMenu = document.createElement("span");
        spanMenu.textContent = "▼";
        spanMenu.className = "row-menu-btn";
        spanMenu.style.marginLeft = "8px";
        spanMenu.onclick = (e) => openDisRowMenu(e, id);
        td.appendChild(spanMenu);
      } else if (index === 3) {
        const btn = document.createElement("button");
        btn.textContent = "上传";
        btn.className = "btn";
        btn.onclick = () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "*/*";
          input.onchange = (e) => uploadEvidence(id, e.target.files[0]);
          input.click();
        };
        td.appendChild(btn);

        const val = row[`col${index}`];
        if (val) {
          const link = document.createElement("a");
          link.href = val;
          link.textContent = row.filename || "下载文件";
          link.download = row.filename || "evidence";
          link.style.marginLeft = "8px";
          td.appendChild(link);

          const delBtn = document.createElement("button");
          delBtn.textContent = "删除";
          delBtn.style.marginLeft = "8px";
          delBtn.onclick = () => deleteEvidence(id);
          td.appendChild(delBtn);
        }
      } else {
        td.contentEditable = true;
        td.textContent = row[`col${index}`] ?? "";
        td.oninput = () => saveDiscontinuedRow(id);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  enableTableColumnResize("#disTable");
  enableStableRowResize("#disTable");
}

async function saveDiscontinuedRow(id) {
  const tr = document.querySelector(`#disTable tbody tr[data-id="${id}"]`);
  const tds = tr.querySelectorAll("td");
  const rowData = {};

  for (let i = 1; i < DIS_HEADERS.length; i++) {
    if (i === 3) continue;
    rowData[`col${i}`] = tds[i].textContent.trim();
  }

  const old = await readData(`${PATH.discontinued}/${id}`);
  if (old && old.col3) rowData.col3 = old.col3;
  if (old && old.filename) rowData.filename = old.filename;

  await updateData(`${PATH.discontinued}/${id}`, rowData);
}

async function addDiscontinuedRow() {
  const id = Date.now();
  const rowData = {};

  for (let i = 1; i < DIS_HEADERS.length; i++) {
    rowData[`col${i}`] = "";
  }

  await writeData(`${PATH.discontinued}/${id}`, rowData);
  await loadDiscontinued();
}

async function addDiscontinuedColumn() {
  const headerRow = document.querySelector("#disHeaderRow");
  const name = prompt("请输入新列名称：", "新列");
  if (!name) return;

  DIS_HEADERS.push(name);

  const th = document.createElement("th");
  th.innerHTML = `${name} <span class="col-menu-btn">▼</span>`;
  th.querySelector(".col-menu-btn").onclick = (e) => openDisColumnMenu(e, th);
  headerRow.appendChild(th);

  const newIndex = DIS_HEADERS.length - 1;

  const data = await readData(PATH.discontinued);
  if (data) {
    const updates = {};
    Object.keys(data).forEach(id => {
      const row = data[id] || {};
      row[`col${newIndex}`] = row[`col${newIndex}`] ?? "";
      updates[id] = row;
    });
    await updateData(PATH.discontinued, updates);
  }

  await updateData(PATH.discontinuedHeaders, DIS_HEADERS);
  await loadDiscontinued();
}

async function uploadEvidence(id, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function (e) {
    const base64 = e.target.result;
    await updateData(`${PATH.discontinued}/${id}`, {
      col3: base64,
      filename: file.name
    });
    await loadDiscontinued();
  };
  reader.readAsDataURL(file);
}

async function deleteEvidence(id) {
  await updateData(`${PATH.discontinued}/${id}`, {
    col3: "",
    filename: ""
  });
  await loadDiscontinued();
}

function openDisRowMenu(event, id) {
  event.stopPropagation();
  const menu = document.getElementById("disRowMenu");
  menu.style.display = "block";
  menu.style.left = event.pageX + "px";
  menu.style.top = event.pageY + "px";
  menu.dataset.id = id;
}

async function deleteDiscontinued(id) {
  await deleteData(`${PATH.discontinued}/${id}`);
  await loadDiscontinued();
}

function deleteDisRowById() {
  const menu = document.getElementById("disRowMenu");
  const id = menu.dataset.id;
  if (id) deleteDiscontinued(id);
  menu.style.display = "none";
}

function openDisColumnMenu(event, thElem) {
  event.stopPropagation();
  const headerRow = document.querySelector("#disHeaderRow");
  currentDisColIndex = Array.from(headerRow.children).indexOf(thElem);

  const menu = document.getElementById("disColMenu");
  menu.style.display = "block";
  menu.style.left = event.pageX + "px";
  menu.style.top = event.pageY + "px";
}

async function deleteDisColumnByIndex() {
  const index = currentDisColIndex;
  if (index == null || index === 0) return;

  const theadRow = document.querySelector("#disHeaderRow");
  const tbodyRows = document.querySelectorAll("#disTable tbody tr");

  theadRow.removeChild(theadRow.children[index]);
  tbodyRows.forEach(tr => tr.removeChild(tr.children[index]));

  const data = await readData(PATH.discontinued);
  if (data) {
    const updates = {};
    Object.keys(data).forEach(id => {
      const row = data[id];
      const newRow = { ...row };
      delete newRow[`col${index}`];
      updates[id] = newRow;
    });
    await updateData(PATH.discontinued, updates);
  }

  DIS_HEADERS.splice(index, 1);
  await updateData(PATH.discontinuedHeaders, DIS_HEADERS);

  const menu = document.getElementById("disColMenu");
  menu.style.display = "none";
  currentDisColIndex = null;

  await loadDiscontinued();
}

/* ---------------- 项目组模块 ---------------- */
let currentGroup = "";
let groupColumns = ["序号", "名称", "厂商", "数量", "备注"];
let currentGroupColumnIndex = null;
let currentGroupRowId = null;

function initGroupColumnsFromHeader() {
  const ths = document.querySelectorAll("#projectGroupHeaderRow th");
  groupColumns = Array.from(ths).map(th => {
    const firstTextNode = Array.from(th.childNodes).find(n => n.nodeType === 3);
    return firstTextNode ? firstTextNode.textContent.trim() : "";
  });
}

function getGroupHeaders() {
  return groupColumns.slice();
}

async function loadGroupHeaders(groupName) {
  const headers = await readData(`${PATH.groups}/${groupName}/_headers`);
  if (headers && Array.isArray(headers)) {
    groupColumns = headers;
    const headerRow = document.getElementById("projectGroupHeaderRow");
    headerRow.innerHTML = "";
    groupColumns.forEach((name, index) => {
      const th = document.createElement("th");
      th.textContent = name;
      if (index === 0) {
        const span = document.createElement("span");
        span.className = "col-menu-btn";
        span.textContent = "▼";
        span.onclick = (e) => openGroupColumnMenu(e, index);
        th.appendChild(span);
      } else {
        const span = document.createElement("span");
        span.className = "col-menu-btn";
        span.textContent = "▼";
        span.onclick = (e) => openGroupColumnMenu(e, index);
        th.appendChild(span);
      }
      headerRow.appendChild(th);
    });
  } else {
    initGroupColumnsFromHeader();
    await updateData(`${PATH.groups}/${groupName}/_headers`, groupColumns);
  }
}

function openProjectGroup(groupName) {
  currentGroup = groupName;
  const title = document.getElementById("projectGroupTitle");
  if (title) title.textContent = groupName + " 项目组";

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("projectGroupTablePage").classList.add("active");

  loadGroupHeaders(groupName).then(() => loadGroup(groupName));
}

async function loadGroup(groupName) {
  const data = await readData(`${PATH.groups}/${groupName}`);
  const tbody = document.querySelector("#projectGroupTable tbody");
  tbody.innerHTML = "";

  if (!data) {
    enableTableColumnResize("#projectGroupTable");
    enableStableRowResize("#projectGroupTable");
    return;
  }

  const headers = getGroupHeaders();

  Object.keys(data).forEach((id, rowIndex) => {
    if (id === "_headers") return;
    const row = data[id];
    const tr = document.createElement("tr");
    tr.dataset.id = id;

    headers.forEach((header, index) => {
      const td = document.createElement("td");

      if (index === 0) {
        td.contentEditable = false;
        td.textContent = rowIndex;

        const spanMenu = document.createElement("span");
        spanMenu.textContent = "▼";
        spanMenu.className = "row-menu-btn";
        spanMenu.style.marginLeft = "8px";
        spanMenu.onclick = (e) => openGroupRowMenu(e, id);
        td.appendChild(spanMenu);
      } else {
        td.contentEditable = true;
        td.textContent = row[header] ?? "";
        td.oninput = () => saveGroupRow(groupName, id);
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  enableTableColumnResize("#projectGroupTable");
  enableStableRowResize("#projectGroupTable");
}

async function saveGroupRow(groupName, id) {
  const tr = document.querySelector(`#projectGroupTable tbody tr[data-id="${id}"]`);
  const headers = getGroupHeaders();
  const tds = tr.querySelectorAll("td");
  const rowData = {};

  tds.forEach((td, index) => {
    if (index === 0) return;
    rowData[headers[index]] = td.textContent.trim() || "";
  });

  await updateData(`${PATH.groups}/${groupName}/${id}`, rowData);
}

async function addGroupRow() {
  if (!currentGroup) return;

  const id = "id" + Date.now();
  const headers = getGroupHeaders();
  const rowData = {};

  headers.forEach(header => {
    if (header !== "序号") rowData[header] = "";
  });

  await writeData(`${PATH.groups}/${currentGroup}/${id}`, rowData);
  await loadGroup(currentGroup);
}

async function addGroupColumn() {
  if (!currentGroup) return;

  const headerRow = document.getElementById("projectGroupHeaderRow");
  const newIndex = groupColumns.length;

  const name = prompt("请输入新列名称：", "新列");
  if (!name) return;

  groupColumns.push(name);

  const th = document.createElement("th");
  th.innerHTML = `${name} <span class="col-menu-btn" onclick="openGroupColumnMenu(event, ${newIndex})">▼</span>`;
  headerRow.appendChild(th);

  const data = await readData(`${PATH.groups}/${currentGroup}`);
  if (data) {
    const updates = {};
    Object.keys(data).forEach(id => {
      if (id === "_headers") return;
      const row = data[id] || {};
      if (!(name in row)) {
        row[name] = "";
      }
      updates[id] = row;
    });
    await updateData(`${PATH.groups}/${currentGroup}`, updates);
  }

  await updateData(`${PATH.groups}/${currentGroup}/_headers`, groupColumns);
  await loadGroup(currentGroup);
}

function openGroupColumnMenu(event, index) {
  event.stopPropagation();
  const th = event.target.closest("th");
  const ths = document.querySelectorAll("#projectGroupHeaderRow th");
  currentGroupColumnIndex = Array.from(ths).indexOf(th);

  const menu = document.getElementById("groupColMenu");
  menu.style.display = "block";
  menu.style.left = event.pageX + "px";
  menu.style.top = event.pageY + "px";
}

async function deleteGroupColumn() {
  if (currentGroupColumnIndex == null) return;

  const headers = getGroupHeaders();
  const headerToDelete = headers[currentGroupColumnIndex];
  if (!headerToDelete) return;

  const table = document.getElementById("projectGroupTable");

  table.querySelectorAll("thead th")[currentGroupColumnIndex].remove();
  table.querySelectorAll("tbody tr").forEach(row => {
    row.children[currentGroupColumnIndex].remove();
  });

  groupColumns.splice(currentGroupColumnIndex, 1);

  const data = await readData(`${PATH.groups}/${currentGroup}`);
  if (data) {
    const updates = {};
    Object.keys(data).forEach(id => {
      if (id === "_headers") return;
      const row = data[id];
      const newRow = { ...row };
      delete newRow[headerToDelete];
      updates[id] = newRow;
    });
    await updateData(`${PATH.groups}/${currentGroup}`, updates);
  }

  await updateData(`${PATH.groups}/${currentGroup}/_headers`, groupColumns);

  document.getElementById("groupColMenu").style.display = "none";
  currentGroupColumnIndex = null;
  await loadGroup(currentGroup);
}

function openGroupRowMenu(event, id) {
  event.stopPropagation();
  currentGroupRowId = id;

  const menu = document.getElementById("groupRowMenu");
  menu.style.display = "block";
  menu.style.left = event.pageX + "px";
  menu.style.top = event.pageY + "px";
}

async function deleteGroupRowByMenu() {
  if (!currentGroupRowId || !currentGroup) return;

  await deleteData(`${PATH.groups}/${currentGroup}/${currentGroupRowId}`);

  currentGroupRowId = null;
  document.getElementById("groupRowMenu").style.display = "none";
  await loadGroup(currentGroup);
}

/* ---------------- 变更历史模块 ---------------- */
let currentHisColIndex = null;
let currentHisRowId = null;

function getHisHeaderCount() {
  return document.querySelector("#hisHeaderRow").children.length;
}

async function loadHistory() {
  let colCount = await readData(PATH.historyColCount);
  if (!colCount || typeof colCount !== "number") {
    colCount = getHisHeaderCount();
    await updateData(PATH.historyColCount, colCount);
  } else {
    const theadRow = document.getElementById("hisHeaderRow");
    const currentCount = theadRow.children.length;
    while (currentCount < colCount) {
      const th = document.createElement("th");
      th.innerHTML = `新列 <span class="col-menu-btn">▼</span>`;
      th.querySelector(".col-menu-btn").onclick = (e) => openHisColumnMenu(e, th);
      theadRow.appendChild(th);
    }
  }

  const data = await readData(PATH.history);
  const tbody = document.querySelector("#hisTable tbody");
  tbody.innerHTML = "";

  if (!data) {
    enableStableRowResize("#hisTable");
    return;
  }

  const ids = Object.keys(data);

  ids.forEach((id, index) => {
    const row = data[id];
    const tr = document.createElement("tr");
    tr.dataset.id = id;

    for (let colIndex = 0; colIndex < colCount; colIndex++) {
      const td = document.createElement("td");

      if (colIndex === 0) {
        td.textContent = index + 1;
        td.contentEditable = false;

        const spanMenu = document.createElement("span");
        spanMenu.textContent = "▼";
        spanMenu.className = "row-menu-btn";
        spanMenu.style.marginLeft = "8px";
        spanMenu.onclick = (e) => openHisRowMenu(e, id);
        td.appendChild(spanMenu);
      } else {
        td.contentEditable = true;
        td.textContent = row[`col${colIndex}`] ?? "";
        td.oninput = () => saveHistoryRow(id);
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });

  enableTableColumnResize("#hisTable");
  enableStableRowResize("#hisTable");
}

async function saveHistoryRow(id) {
  const tr = document.querySelector(`#hisTable tbody tr[data-id="${id}"]`);
  const tds = tr.children;
  const colCount = getHisHeaderCount();
  const rowData = {};

  for (let colIndex = 1; colIndex < colCount; colIndex++) {
    rowData[`col${colIndex}`] = tds[colIndex].textContent.trim();
  }

  await updateData(`${PATH.history}/${id}`, rowData);
}

async function addHistoryRow() {
  const id = Date.now();
  const colCount = getHisHeaderCount();
  const rowData = {};

  for (let colIndex = 1; colIndex < colCount; colIndex++) {
    rowData[`col${colIndex}`] = "";
  }

  await writeData(`${PATH.history}/${id}`, rowData);
  await loadHistory();
}

function openHisRowMenu(event, id) {
  event.stopPropagation();
  currentHisRowId = id;

  const menu = document.getElementById("hisRowMenu");
  menu.style.display = "block";
  menu.style.left = event.pageX + "px";
  menu.style.top = event.pageY + "px";
}

async function deleteHisRowById() {
  await deleteData(`${PATH.history}/${currentHisRowId}`);
  currentHisRowId = null;
  document.getElementById("hisRowMenu").style.display = "none";
  await loadHistory();
}

function openHisColumnMenu(event, thElem) {
  event.stopPropagation();
  const theadRow = document.querySelector("#hisHeaderRow");
  currentHisColIndex = Array.from(theadRow.children).indexOf(thElem);

  const menu = document.getElementById("hisColMenu");
  menu.style.display = "block";
  menu.style.left = event.pageX + "px";
  menu.style.top = event.pageY + "px";
}

async function deleteHisColumnByIndex() {
  const index = currentHisColIndex;
  if (index == null || index === 0) return;

  const theadRow = document.querySelector("#hisHeaderRow");
  const tbodyRows = document.querySelectorAll("#hisTable tbody tr");

  theadRow.removeChild(theadRow.children[index]);
  tbodyRows.forEach(tr => tr.removeChild(tr.children[index]));

  const data = await readData(PATH.history);
  const updates = {};

  Object.keys(data || {}).forEach(id => {
    const row = data[id];
    const newRow = { ...row };
    delete newRow[`col${index}`];
    updates[id] = newRow;
  });

  await updateData(PATH.history, updates);

  const newColCount = getHisHeaderCount();
  await updateData(PATH.historyColCount, newColCount);

  document.getElementById("hisColMenu").style.display = "none";
  currentHisColIndex = null;

  await loadHistory();
}

async function addHistoryColumn() {
  const theadRow = document.getElementById("hisHeaderRow");
  const colName = prompt("请输入新列名称：");
  if (!colName) return;

  const th = document.createElement("th");
  th.draggable = true;
  th.innerHTML = `${colName} <span class="col-menu-btn">▼</span>`;
  th.querySelector(".col-menu-btn").onclick = (e) => openHisColumnMenu(e, th);
  theadRow.appendChild(th);

  const colIndex = getHisHeaderCount() - 1;

  const tbodyRows = document.querySelectorAll("#hisTable tbody tr");
  for (let tr of tbodyRows) {
    const id = tr.dataset.id;

    const td = document.createElement("td");
    td.contentEditable = true;
    td.textContent = "";
    td.oninput = () => saveHistoryRow(id);
    tr.appendChild(td);

    await updateData(`${PATH.history}/${id}`, {
      [`col${colIndex}`]: ""
    });
  }

  await updateData(PATH.historyColCount, getHisHeaderCount());
  await loadHistory();
}

/* ---------------- 全局菜单关闭 ---------------- */
document.addEventListener("click", function (e) {
  const menus = [
    document.getElementById("colMenu"),
    document.getElementById("rowMenu"),
    document.getElementById("groupColMenu"),
    document.getElementById("groupRowMenu"),
    document.getElementById("disColMenu"),
    document.getElementById("disRowMenu"),
    document.getElementById("hisColMenu"),
    document.getElementById("hisRowMenu")
  ];

  menus.forEach(menu => {
    if (!menu) return;
    if (!menu.contains(e.target) &&
      !e.target.classList.contains("col-menu-btn") &&
      !e.target.classList.contains("row-menu-btn")) {
      menu.style.display = "none";
    }
  });
});

/* ---------------- 页面加载 ---------------- */
async function reloadAll() {
  await loadReagents();
  await loadDiscontinued();
  await loadHistory();
  updateStats();
  setupSearch();
}

reloadAll();

/* ---------------- 暴露到 window ---------------- */
window.showPage = showPage;

window.addReagentRow = addReagentRow;
window.addColumn = addColumn;
window.openColumnMenu = openColumnMenu;
window.deleteColumnByIndex = deleteColumnByIndex;
window.openRowMenu = openRowMenu;
window.deleteRowById = deleteRowById;

window.openProjectGroup = openProjectGroup;
window.loadGroup = loadGroup;
window.saveGroupRow = saveGroupRow;
window.addGroupRow = addGroupRow;
window.addGroupColumn = addGroupColumn;
window.openGroupRowMenu = openGroupRowMenu;
window.openGroupColumnMenu = openGroupColumnMenu;
window.deleteGroupRowByMenu = deleteGroupRowByMenu;
window.deleteGroupColumn = deleteGroupColumn;

window.addDiscontinuedRow = addDiscontinuedRow;
window.addDiscontinuedColumn = addDiscontinuedColumn;
window.deleteDiscontinued = deleteDiscontinued;
window.openDisRowMenu = openDisRowMenu;
window.deleteDisRowById = deleteDisRowById;
window.openDisColumnMenu = openDisColumnMenu;
window.deleteDisColumnByIndex = deleteDisColumnByIndex;

window.loadHistory = loadHistory;
window.addHistoryRow = addHistoryRow;
window.addHistoryColumn = addHistoryColumn;
window.openHisColumnMenu = openHisColumnMenu;
window.deleteHisColumnByIndex = deleteHisColumnByIndex;
window.openHisRowMenu = openHisRowMenu;
window.deleteHisRowById = deleteHisRowById;

window.enableStableRowResize = enableStableRowResize;
window.enableTableColumnResize = enableTableColumnResize;

window.PATH = PATH;
window.readData = readData;
window.updateData = updateData;
window.writeData = writeData;
window.deleteData = deleteData;
