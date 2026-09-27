/**
 * Parse a CSV string into rows of string cells.
 * Handles quoted fields, escaped quotes (""), and empty values.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  // Normalize newlines
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  while (i < s.length) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      cell = "";
      // Skip completely empty trailing lines
      if (row.length > 1 || row[0] !== "") {
        rows.push(row);
      }
      row = [];
      i++;
      continue;
    }

    cell += ch;
    i++;
  }

  // Final cell / row (no trailing newline)
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || row[0] !== "") {
      rows.push(row);
    }
  }

  return rows;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTable(rows) {
  const output = document.getElementById("output");
  const status = document.getElementById("status");

  if (!rows.length) {
    output.innerHTML = '<p class="empty-state">No data to display.</p>';
    status.textContent = "";
    status.classList.remove("error");
    return;
  }

  const [headers, ...data] = rows;
  const colCount = headers.length;

  let html = '<div class="table-wrap"><table><thead><tr>';
  for (const h of headers) {
    html += `<th>${escapeHtml(h)}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (const row of data) {
    html += "<tr>";
    for (let c = 0; c < colCount; c++) {
      const value = row[c] ?? "";
      html += `<td>${escapeHtml(value)}</td>`;
    }
    html += "</tr>";
  }

  html += "</tbody></table></div>";
  output.innerHTML = html;
  status.textContent = `${data.length} row${data.length === 1 ? "" : "s"}, ${colCount} column${colCount === 1 ? "" : "s"}`;
  status.classList.remove("error");
}

function parseAndRender() {
  const text = document.getElementById("input").value.trim();
  const status = document.getElementById("status");

  if (!text) {
    document.getElementById("output").innerHTML =
      '<p class="empty-state">Paste CSV data above, then click Parse CSV.</p>';
    status.textContent = "";
    return;
  }

  try {
    const rows = parseCsv(text);
    renderTable(rows);
  } catch (err) {
    status.textContent = "Failed to parse CSV.";
    status.classList.add("error");
    document.getElementById("output").innerHTML = "";
    console.error(err);
  }
}

document.getElementById("parse").addEventListener("click", parseAndRender);
document.getElementById("clear").addEventListener("click", () => {
  document.getElementById("input").value = "";
  document.getElementById("output").innerHTML = "";
  document.getElementById("status").textContent = "";
  document.getElementById("status").classList.remove("error");
});

// Parse on Ctrl/Cmd+Enter
document.getElementById("input").addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    parseAndRender();
  }
});
