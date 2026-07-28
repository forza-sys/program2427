// timeline.js - Interactive Horizontal Diagram Benchmark (16:9 Fit-to-Screen View)
(function() {
  const TIMELINE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTPLWmWrZXEFFUxR6gmForZ-FgPCc1ePG_AxNRnac3RApPSPKi9oLH8AKGk3BdChAFZ5rbv6Mg2KQkd/pub?gid=1437698506&single=true&output=csv';

  let rawTimelineEvents = [];
  let currentSelectedStatus = 'TERLAKSANA'; // TERLAKSANA, BELUM

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

      initTabEvents();
      renderDiagram();
    } catch (err) {
      console.error('Error loading diagram timeline data:', err);
    }
  }

  function initTabEvents() {
    document.querySelectorAll('.status-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.status-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSelectedStatus = btn.getAttribute('data-status');

        const activeDisplay = document.getElementById('active-status-display');
        if (activeDisplay) {
          if (currentSelectedStatus === 'ALL') activeDisplay.textContent = 'Semua Status';
          else if (currentSelectedStatus === 'TERLAKSANA') activeDisplay.textContent = 'Sudah Terlaksana';
          else if (currentSelectedStatus === 'BELUM') activeDisplay.textContent = 'Belum Terlaksana';
        }

        renderDiagram();
      });
    });
  }

  function getTimelineRange() {
    // Generate absolute months list for the entire possible range
    const allMonths = [];
    for (let y = 2024; y <= 2027; y++) {
      for (let m = 0; m < 12; m++) {
        allMonths.push({
          year: y,
          month: m,
          label: `${MONTH_NAMES[m]} '${y.toString().substring(2)}`,
          absIndex: (y - 2024) * 12 + m
        });
      }
    }

    // Jul 2024 (idx 6) to Jun 2027 (idx 6+35 = 41)
    let startIdx = 6;
    let endIdx = 41;

    if (currentSelectedStatus === 'TERLAKSANA') {
      startIdx = 6;  // Jul 2024
      endIdx = 30;   // Jul 2026
    } else if (currentSelectedStatus === 'BELUM') {
      startIdx = 30; // Jul 2026
      endIdx = 41;   // Jun 2027
    }

    return allMonths.slice(startIdx, endIdx + 1);
  }

  function renderDiagram() {
    const axisContainer = document.getElementById('axis-nodes-container');
    if (!axisContainer) return;

    // Determine Axis Range based on filter
    const timelineMonths = getTimelineRange();
    const nodeCount = timelineMonths.length;
    const startAbs = timelineMonths[0].absIndex;
    const endAbs = timelineMonths[nodeCount - 1].absIndex;

    // Filter events by selected status and clamp them to view
    let filteredEvents = rawTimelineEvents.filter(e => {
      if (currentSelectedStatus === 'ALL') return true;
      if (currentSelectedStatus === 'TERLAKSANA') return e.isTerlaksana;
      if (currentSelectedStatus === 'BELUM') return !e.isTerlaksana;
      return true;
    });

    // Map events to current timeline axis indices
    filteredEvents = filteredEvents.map(e => {
      const eStartAbs = (e.startYear - 2024) * 12 + e.startMonth;
      const eEndAbs = (e.endYear - 2024) * 12 + e.endMonth;
      
      return {
        ...e,
        renderStartIdx: Math.max(0, Math.min(nodeCount - 1, eStartAbs - startAbs)),
        renderEndIdx: Math.max(0, Math.min(nodeCount - 1, eEndAbs - startAbs))
      };
    });

    // Update Stats Badge
    const statsBadge = document.getElementById('event-stats-badge');
    if (statsBadge) {
      const terlaksana = filteredEvents.filter(e => e.isTerlaksana).length;
      statsBadge.textContent = `${filteredEvents.length} Event (${terlaksana} Terlaksana, ${filteredEvents.length - terlaksana} Akan Datang)`;
    }

    // Build Axis Nodes HTML
    let axisHTML = '';

    for (let i = 0; i < nodeCount; i++) {
      const leftPct = (i / (nodeCount - 1)) * 100;
      axisHTML += `
        <div class="axis-node" style="position: absolute; left: ${leftPct}%; top: 50%; transform: translate(-50%, -50%);" data-month="${i}">
          <div class="axis-label" style="font-size: 0.65rem; white-space: nowrap; transform: rotate(-45deg); margin-top: 10px; margin-left: -5px; text-align: right;">${timelineMonths[i].label}</div>
        </div>
      `;
    }

    // Group single events by render index to prevent overlap ("bertumpuk")
    const pointEvents = filteredEvents.filter(e => !e.isRange);
    const monthGroups = {};
    pointEvents.forEach(ev => {
      if (!monthGroups[ev.renderStartIdx]) monthGroups[ev.renderStartIdx] = [];
      monthGroups[ev.renderStartIdx].push(ev);
    });

    const baseHeights = [110, 170, 230]; // 60px staggering for adjacent months
    const stackStep = 180; // 3 * 60px = 180px stack step ensures perfect non-overlapping grid

    pointEvents.forEach(ev => {
      const mIdx = ev.renderStartIdx;
      const group = monthGroups[mIdx];
      const groupIdx = group.indexOf(ev);
      
      let leftPct = (mIdx / (nodeCount - 1)) * 100;
      
      const baseTier = mIdx % 3;
      const connectorHeight = baseHeights[baseTier] + (groupIdx * stackStep);

      const badgeCls = ev.isTerlaksana ? 'terlaksana' : 'akan';

      axisHTML += `
        <div class="event-pin" style="left: ${leftPct}%; bottom: 6px;" onclick="showTooltip('${encodeURIComponent(JSON.stringify(ev))}', event)">
          <div class="pin-badge ${badgeCls}">
            <div class="pin-date">${ev.waktu}</div>
            <div class="pin-title">${ev.nama}</div>
          </div>
          <div class="pin-shape"></div>
          <div class="pin-connector" style="height: ${connectorHeight}px;"></div>
        </div>
      `;
    });

    // Range Events (Rendered Below Axis)
    const rangeEvents = filteredEvents.filter(e => e.isRange);
    let rangeTopOffset = 65; // Push down to avoid overlapping with slanted axis labels

    rangeEvents.forEach(ev => {
      const startPct = (ev.renderStartIdx / (nodeCount - 1)) * 100;
      const endPct = (ev.renderEndIdx / (nodeCount - 1)) * 100;
      const widthPct = Math.max(3, endPct - startPct);

      axisHTML += `
        <div class="range-bar-item" style="left: ${startPct}%; width: ${widthPct}%; top: ${rangeTopOffset}px;" onclick="showTooltip('${encodeURIComponent(JSON.stringify(ev))}', event)">
          <div class="range-dot"></div>
          <div class="range-text">${ev.nama} (${ev.waktu})</div>
          <div class="range-dot"></div>
        </div>
      `;

      rangeTopOffset += 42; // Stack downward for multiple range bars (taller box + gap)
    });

    axisContainer.innerHTML = axisHTML;
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
