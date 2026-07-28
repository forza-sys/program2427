// timeline.js - Interactive Horizontal Diagram Benchmark (16:9 Fit-to-Screen View)
(function() {
  const TIMELINE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTPLWmWrZXEFFUxR6gmForZ-FgPCc1ePG_AxNRnac3RApPSPKi9oLH8AKGk3BdChAFZ5rbv6Mg2KQkd/pub?gid=1437698506&single=true&output=csv';

  let rawTimelineEvents = [];

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function parseCSV(text) {
    const lines = [];
    let curLine = [];
    let curToken = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const nextC = text[i + 1];

      if (c === '"') {
        if (inQuotes && nextC === '"') {
          curToken += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        curLine.push(curToken.trim());
        curToken = '';
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && nextC === '\n') i++;
        curLine.push(curToken.trim());
        if (curLine.some(cell => cell.length > 0)) {
          lines.push(curLine);
        }
        curLine = [];
        curToken = '';
      } else {
        curToken += c;
      }
    }
    if (curToken.length > 0 || curLine.length > 0) {
      curLine.push(curToken.trim());
      if (curLine.some(cell => cell.length > 0)) {
        lines.push(curLine);
      }
    }
    return lines;
  }

  function parseMonthIndex(str) {
    if (!str) return 0;
    const lower = str.toLowerCase();
    if (lower.includes('jan')) return 0;
    if (lower.includes('feb')) return 1;
    if (lower.includes('mar')) return 2;
    if (lower.includes('apr')) return 3;
    if (lower.includes('mei') || lower.includes('may')) return 4;
    if (lower.includes('jun')) return 5;
    if (lower.includes('jul')) return 6;
    if (lower.includes('agu') || lower.includes('aug')) return 7;
    if (lower.includes('sep')) return 8;
    if (lower.includes('okt') || lower.includes('oct')) return 9;
    if (lower.includes('nov')) return 10;
    if (lower.includes('des') || lower.includes('dec')) return 11;
    return 0;
  }

  function parseEventDates(waktuStr) {
    if (!waktuStr) return { startYear: 2026, startMonth: 0, endYear: 2026, endMonth: 0, isRange: false };

    const yearMatch = waktuStr.match(/\b(202[0-9])\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

    const parts = waktuStr.split('-').map(p => p.trim());
    if (parts.length === 2 && parts[0].match(/[a-zA-Z]/) && parts[1].match(/[a-zA-Z]/)) {
      const sMonth = parseMonthIndex(parts[0]);
      const eMonth = parseMonthIndex(parts[1]);
      return { 
        startYear: year, startMonth: sMonth, 
        endYear: year, endMonth: eMonth, 
        isRange: true 
      };
    }

    const sMonth = parseMonthIndex(waktuStr);
    return { startYear: year, startMonth: sMonth, endYear: year, endMonth: sMonth, isRange: false };
  }

  async function loadData() {
    try {
      const res = await fetch(TIMELINE_CSV_URL + '&_t=' + Date.now());
      const text = await res.text();
      const rows = parseCSV(text);

      if (rows.length < 2) return;

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const idxWaktu = headers.findIndex(h => h.includes('waktu') || h.includes('tanggal'));
      const idxNama = headers.findIndex(h => h.includes('nama') || h.includes('event'));
      const idxTema = headers.findIndex(h => h.includes('tema'));
      const idxBahasan = headers.findIndex(h => h.includes('pembahasan') || h.includes('utama'));
      const idxStatus = headers.findIndex(h => h.includes('status'));

      rawTimelineEvents = rows.slice(1).map(row => {
        const waktu = idxWaktu !== -1 ? row[idxWaktu] : '';
        const parsedDate = parseEventDates(waktu);
        const status = idxStatus !== -1 ? (row[idxStatus] || 'Akan Dilaksanakan').trim() : 'Akan Dilaksanakan';
        const isTerlaksana = status.toLowerCase().includes('sudah') || status.toLowerCase().includes('terlaksana');
        
        return {
          waktu: waktu,
          startYear: parsedDate.startYear,
          startMonth: parsedDate.startMonth,
          endYear: parsedDate.endYear,
          endMonth: parsedDate.endMonth,
          isRange: parsedDate.isRange,
          nama: idxNama !== -1 ? row[idxNama] : '',
          tema: idxTema !== -1 ? row[idxTema] : '',
          bahasan: idxBahasan !== -1 ? row[idxBahasan] : '',
          status: status,
          isTerlaksana: isTerlaksana
        };
      }).filter(e => e.nama);

      renderDiagram();
    } catch (err) {
      console.error('Error loading diagram timeline data:', err);
    }
  }

  function renderDiagram() {
    const ganttContainer = document.getElementById('gantt-container');
    if (!ganttContainer) return;

    // 1. Identify all active months (months that have events or are spanned by events)
    const activeMonthAbsIndices = new Set();
    rawTimelineEvents.forEach(e => {
      const startAbs = (e.startYear - 2024) * 12 + e.startMonth;
      const endAbs = (e.endYear - 2024) * 12 + e.endMonth;
      for (let i = startAbs; i <= endAbs; i++) {
        activeMonthAbsIndices.add(i);
      }
    });

    const sortedActiveAbsIndices = Array.from(activeMonthAbsIndices).sort((a,b) => a - b);
    const nodeCount = sortedActiveAbsIndices.length;
    if (nodeCount === 0) {
      ganttContainer.innerHTML = '<div style="padding: 20px;">Belum ada data diagram.</div>';
      return;
    }

    // Map absIndex to grid column index (1-based for CSS Grid)
    const absToGridCol = {};
    sortedActiveAbsIndices.forEach((abs, i) => {
      absToGridCol[abs] = i + 1;
    });

    // 2. Determine the split point for "Sudah Terlaksana" vs "Belum Terlaksana"
    // Find the first month that has a "Belum Terlaksana" event
    let firstBelumAbs = Infinity;
    rawTimelineEvents.forEach(e => {
      if (!e.isTerlaksana) {
        const startAbs = (e.startYear - 2024) * 12 + e.startMonth;
        if (startAbs < firstBelumAbs) firstBelumAbs = startAbs;
      }
    });

    let splitColIdx = nodeCount + 1; // Default to all Terlaksana
    if (firstBelumAbs !== Infinity && absToGridCol[firstBelumAbs]) {
      splitColIdx = absToGridCol[firstBelumAbs];
    }

    // 3. Grid Row Allocation (Collision Avoidance)
    const rows = []; // rows[rowIndex] = array of {startCol, endCol}
    
    // Sort events: start date asc, then duration desc
    const sortedEvents = [...rawTimelineEvents].sort((a, b) => {
      const aStart = (a.startYear - 2024) * 12 + a.startMonth;
      const bStart = (b.startYear - 2024) * 12 + b.startMonth;
      if (aStart !== bStart) return aStart - bStart;
      const aDur = ((a.endYear - 2024) * 12 + a.endMonth) - aStart;
      const bDur = ((b.endYear - 2024) * 12 + b.endMonth) - bStart;
      return bDur - aDur;
    });

    const eventRenderData = sortedEvents.map(e => {
      const startAbs = (e.startYear - 2024) * 12 + e.startMonth;
      const endAbs = (e.endYear - 2024) * 12 + e.endMonth;
      const startCol = absToGridCol[startAbs];
      const endCol = absToGridCol[endAbs];

      // Find an empty row
      let placedRow = -1;
      for (let r = 0; r < rows.length; r++) {
        let overlap = false;
        for (let item of rows[r]) {
          // Two ranges [start1, end1] and [start2, end2] overlap if start1 <= end2 AND start2 <= end1
          if (startCol <= item.endCol && item.startCol <= endCol) {
            overlap = true;
            break;
          }
        }
        if (!overlap) {
          placedRow = r;
          break;
        }
      }
      
      if (placedRow === -1) {
        placedRow = rows.length;
        rows.push([]);
      }
      rows[placedRow].push({ startCol, endCol });

      return {
        ...e,
        startCol,
        endCol,
        gridRow: placedRow + 3 // +3 because row 1 is Top Header, row 2 is Month Header
      };
    });

    // 4. Build HTML
    // Set grid columns (160px per month) and rows
    const totalRows = rows.length + 2;
    ganttContainer.style.gridTemplateColumns = `repeat(${nodeCount}, 160px)`;
    ganttContainer.style.gridTemplateRows = `40px 40px repeat(${rows.length}, minmax(120px, auto))`;

    let html = '';

    // A. Top Headers (Sudah Terlaksana & Belum Terlaksana)
    if (splitColIdx > 1) {
      html += `<div class="gantt-header-top terlaksana" style="grid-column: 1 / ${splitColIdx}; grid-row: 1;">SUDAH TERLAKSANA</div>`;
    }
    if (splitColIdx <= nodeCount) {
      html += `<div class="gantt-header-top belum" style="grid-column: ${splitColIdx} / ${nodeCount + 1}; grid-row: 1;">BELUM TERLAKSANA</div>`;
    }

    // B. Month Headers
    sortedActiveAbsIndices.forEach((abs, i) => {
      const y = Math.floor(abs / 12) + 2024;
      const m = abs % 12;
      const label = `${MONTH_NAMES[m]} '${y.toString().substring(2)}`;
      const col = i + 1;
      
      html += `<div class="gantt-header-month" style="grid-column: ${col} / ${col + 1}; grid-row: 2;">${label}</div>`;
      
      // Vertical dashed lines for the entire grid
      html += `<div class="gantt-cell" style="grid-column: ${col} / ${col + 1}; grid-row: 3 / ${totalRows + 1};"></div>`;
    });

    // C. Event Cards
    eventRenderData.forEach(ev => {
      const cls = ev.isTerlaksana ? 'terlaksana' : 'akan';
      
      // Update stats badge
      const tooltipData = encodeURIComponent(JSON.stringify(ev));
      html += `
        <div class="gantt-event-card ${cls}" style="grid-column: ${ev.startCol} / ${ev.endCol + 1}; grid-row: ${ev.gridRow};" onclick="showTooltip('${tooltipData}', event)">
          ${ev.nama}
        </div>
      `;
    });

    ganttContainer.innerHTML = html;

    // Update Stats Badge
    const statsBadge = document.getElementById('event-stats-badge');
    if (statsBadge) {
      const terlaksana = rawTimelineEvents.filter(e => e.isTerlaksana).length;
      statsBadge.textContent = `${rawTimelineEvents.length} Event (${terlaksana} Terlaksana, ${rawTimelineEvents.length - terlaksana} Akan Datang)`;
    }
  }

  window.showTooltip = function(jsonStr, event) {
    if (event) event.stopPropagation();
    try {
      const ev = JSON.parse(decodeURIComponent(jsonStr));
      const tooltip = document.getElementById('event-tooltip');
      if (!tooltip) return;

      document.getElementById('tooltip-date').textContent = ev.waktu;
      document.getElementById('tooltip-title').textContent = ev.nama;

      const statusEl = document.getElementById('tooltip-status');
      statusEl.textContent = ev.status;
      statusEl.style.background = ev.isTerlaksana ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)';
      statusEl.style.color = ev.isTerlaksana ? '#059669' : '#2563eb';

      let desc = '';
      if (ev.tema) desc += `<strong>Tema:</strong> ${ev.tema}<br>`;
      if (ev.bahasan) desc += `<strong>Pembahasan:</strong> ${ev.bahasan}`;
      if (!desc) desc = 'Event resmi Forum Zakat dalam agenda nasional.';

      document.getElementById('tooltip-desc').innerHTML = desc;
      tooltip.style.display = 'block';
    } catch (err) {
      console.error('Tooltip error:', err);
    }
  };

  document.addEventListener('DOMContentLoaded', loadData);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    loadData();
  }
})();
