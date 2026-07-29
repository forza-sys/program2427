// laporan-bidang-4.js - Monitoring Turunan Program Bidang 4
(function() {
  const PROGRAM_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQjbh4RvNbXtPPOgYPvIj1Z_qRa3d9a8FcdUH_bWzNcmykXd1dlN_2E1zRzuX2jpIyYvCrt-IUNMauZ/pub?output=csv&gid=1316280968';

  let rawProgramsData = [];
  let statusChartInstance = null;

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

  async function loadData() {
    try {
      const res = await fetch(PROGRAM_CSV_URL + '&_t=' + Date.now());
      const text = await res.text();
      const rows = parseCSV(text);

      if (rows.length < 2) return;

      const headers = rows[0].map(h => h.toLowerCase().trim());
      // Columns: No, Program, Turunan Program, Status, Keterangan
      const idxNo = headers.findIndex(h => h === 'no');
      const idxProgram = headers.findIndex(h => h === 'program');
      const idxTurunan = headers.findIndex(h => h.includes('turunan'));
      const idxStatus = headers.findIndex(h => h === 'status');
      const idxKet = headers.findIndex(h => h.includes('keterangan'));

      let currentProgramInduk = '';
      
      rawProgramsData = rows.slice(1).map(row => {
        let programVal = idxProgram !== -1 ? row[idxProgram] : '';
        if (programVal) {
          currentProgramInduk = programVal;
        } else {
          programVal = currentProgramInduk;
        }

        return {
          no: idxNo !== -1 ? row[idxNo] : '',
          program_induk: programVal,
          turunan_program: idxTurunan !== -1 ? row[idxTurunan] : '',
          status: idxStatus !== -1 ? (row[idxStatus] || 'Belum Terdefinisi').trim() : 'Belum Terdefinisi',
          ket: idxKet !== -1 ? row[idxKet] : ''
        };
      }).filter(p => p.turunan_program);

      // Hide the second chart container (Bidang chart)
      const bidangChartCanvas = document.getElementById('bidangBarChart');
      if (bidangChartCanvas) {
        bidangChartCanvas.parentElement.parentElement.style.display = 'none';
      }

      renderAll();
    } catch (err) {
      console.error('Error loading program data:', err);
      const container = document.getElementById('program-cards-list');
      if (container) {
        container.innerHTML = `<div style="grid-column: 1/-1; color: #ef4444; padding: 20px; text-align: center;">Gagal memuat data program: ${err.message}</div>`;
      }
    }
  }

  function getFilteredData() {
    const searchVal = (document.getElementById('search-program-input')?.value || '').toLowerCase();
    const statusVal = document.getElementById('status-filter-select')?.value || 'ALL';

    return rawProgramsData.filter(p => {
      const matchStatus = (statusVal === 'ALL' || p.status.toLowerCase() === statusVal.toLowerCase());
      const matchSearch = !searchVal || 
        p.program_induk.toLowerCase().includes(searchVal) || 
        p.turunan_program.toLowerCase().includes(searchVal) || 
        p.ket.toLowerCase().includes(searchVal);

      return matchStatus && matchSearch;
    });
  }

  function renderAll() {
    const filtered = getFilteredData();
    renderKPIs(filtered);
    renderCards(filtered);
    initCharts(filtered);
  }

  function renderKPIs(data) {
    const total = data.length;
    const selesai = data.filter(p => p.status === 'Selesai').length;
    const process = data.filter(p => p.status === 'Berjalan' || p.status === 'On Process').length;
    const rencana = data.filter(p => p.status === 'Direncanakan').length;

    const kpiTotal = document.getElementById('kpi-total-proker');
    const kpiSelesai = document.getElementById('kpi-selesai-proker');
    const kpiSelesaiPct = document.getElementById('kpi-selesai-pct');
    const kpiProcess = document.getElementById('kpi-process-proker');
    const kpiProcessPct = document.getElementById('kpi-process-pct');
    const kpiRencana = document.getElementById('kpi-rencana-proker');
    const kpiRencanaPct = document.getElementById('kpi-rencana-pct');
    const kpiAvg = document.getElementById('kpi-avg-progress');

    if (kpiTotal) kpiTotal.textContent = total;
    if (kpiSelesai) kpiSelesai.textContent = selesai;
    if (kpiSelesaiPct) kpiSelesaiPct.textContent = total ? Math.round((selesai/total)*100) + '% dari total' : '0%';
    
    if (kpiProcess) kpiProcess.textContent = process;
    if (kpiProcessPct) kpiProcessPct.textContent = total ? Math.round((process/total)*100) + '% dari total' : '0%';
    
    if (kpiRencana) kpiRencana.textContent = rencana;
    if (kpiRencanaPct) kpiRencanaPct.textContent = total ? Math.round((rencana/total)*100) + '% dari total' : '0%';

    if (kpiAvg) {
      kpiAvg.textContent = total ? Math.round(((selesai * 100) + (process * 50)) / total) + '%' : '0%';
    }
  }

  function renderCards(data) {
    const container = document.getElementById('program-cards-list');
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #9ca3af; background: var(--card-bg, #fff); border-radius: 16px; border: 1.5px dashed #e5e7eb;">Tidak ada program turunan yang ditemukan.</div>`;
      return;
    }

    let html = '';
    data.forEach(p => {
      let statusColor = '#9ca3af';
      let statusBg = '#f3f4f6';
      
      const s = p.status.toLowerCase();
      if (s === 'selesai') {
        statusColor = '#10b981';
        statusBg = '#d1fae5';
      } else if (s === 'on process' || s === 'berjalan') {
        statusColor = '#3b82f6';
        statusBg = '#dbeafe';
      } else if (s === 'direncanakan') {
        statusColor = '#f59e0b';
        statusBg = '#fef3c7';
      }

      html += \`
        <div class="program-card">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <span style="background: \${statusBg}; color: \${statusColor}; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                \${p.status}
              </span>
              <span style="font-size: 0.75rem; font-weight: 600; color: #6366f1; background: #e0e7ff; padding: 4px 10px; border-radius: 6px;">
                <i class="ph-light ph-folder-notch"></i> Induk: \${p.program_induk || 'Umum'}
              </span>
            </div>
            
            <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; font-weight: 700; color: var(--heading-color, #111827); line-height: 1.4;">
              \${p.turunan_program}
            </h3>
            
            <p style="margin: 0; font-size: 0.85rem; color: #6b7280; line-height: 1.5; display: flex; align-items: flex-start; gap: 6px;">
              <i class="ph-light ph-info" style="font-size: 1rem; margin-top: 2px;"></i>
              \${p.ket || 'Tidak ada keterangan spesifik.'}
            </p>
          </div>
        </div>
      \`;
    });

    container.innerHTML = html;
  }

  function initCharts(data) {
    const statusCtx = document.getElementById('statusDonutChart');
    if (!statusCtx) return;

    const counts = {
      selesai: data.filter(p => p.status === 'Selesai').length,
      process: data.filter(p => p.status === 'Berjalan' || p.status === 'On Process').length,
      rencana: data.filter(p => p.status === 'Direncanakan').length,
      lainnya: data.filter(p => !['Selesai', 'Berjalan', 'On Process', 'Direncanakan'].includes(p.status)).length
    };

    if (statusChartInstance) statusChartInstance.destroy();

    statusChartInstance = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Selesai', 'Berjalan/On Process', 'Direncanakan', 'Lainnya'],
        datasets: [{
          data: [counts.selesai, counts.process, counts.rencana, counts.lainnya],
          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#9ca3af'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11, family: "'Inter', sans-serif" } } }
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-program-input')?.addEventListener('input', renderAll);
    document.getElementById('status-filter-select')?.addEventListener('change', renderAll);
    
    // Download as Image functionality
    const downloadBtn = document.getElementById('btn-download-img');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<i class="ph-light ph-spinner spinner-rotate"></i> Memproses...';
        downloadBtn.disabled = true;
        
        // Hide the download button during capture so it doesn't appear in the image
        downloadBtn.style.display = 'none';

        html2canvas(document.querySelector("main"), {
          scale: 2,
          useCORS: true,
          backgroundColor: '#f8fafc'
        }).then(canvas => {
          downloadBtn.style.display = 'flex';
          downloadBtn.innerHTML = originalText;
          downloadBtn.disabled = false;
          
          const imgData = canvas.toDataURL('image/jpeg', 0.9);
          const link = document.createElement('a');
          link.href = imgData;
          link.download = 'Laporan_Bidang_4.jpg';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }).catch(err => {
          console.error("Gagal mendownload gambar", err);
          downloadBtn.style.display = 'flex';
          downloadBtn.innerHTML = originalText;
          downloadBtn.disabled = false;
          alert("Gagal mendownload gambar.");
        });
      });
    }

    loadData();
  });

})();
