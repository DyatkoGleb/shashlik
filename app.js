// Константы подключаются из config.js
var SUPABASE_URL = typeof window !== 'undefined' && window.SUPABASE_URL ? window.SUPABASE_URL : '';
var SUPABASE_ANON_KEY = typeof window !== 'undefined' && window.SUPABASE_ANON_KEY ? window.SUPABASE_ANON_KEY : '';
var YANDEX_MAPS_API_KEY = typeof window !== 'undefined' && window.YANDEX_MAPS_API_KEY ? window.YANDEX_MAPS_API_KEY : '';
var WEEKENDS = typeof window !== 'undefined' && window.WEEKENDS ? window.WEEKENDS : [];
var VOLGOGRAD = typeof window !== 'undefined' && window.VOLGOGRAD ? window.VOLGOGRAD : { lat: 48.708, lon: 44.513 };
var WMO_WEATHER = typeof window !== 'undefined' && window.WMO_WEATHER ? window.WMO_WEATHER : {};

let supabaseClient = null;
(function () {
  var lib = typeof supabase !== 'undefined' ? supabase : (typeof window !== 'undefined' && window.supabase ? window.supabase : null);
  if (lib && typeof lib.createClient === 'function' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseClient = lib.createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());
  }
})();

function weatherDesc(code) {
  return WMO_WEATHER[code] || 'разная';
}

function getWeekendDatesForArchive() {
  const y = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return [
    { start: `${y}-04-18`, end: `${y}-04-19` },
    { start: `${y}-04-25`, end: `${y}-04-26` },
    { start: `${y}-05-02`, end: `${y}-05-03` },
    { start: `${y}-05-09`, end: `${y}-05-10` },
    { start: `${y}-05-16`, end: `${y}-05-17` },
    { start: `${y}-05-23`, end: `${y}-05-24` }
  ];
}

function getTripId() {
  const params = new URLSearchParams(location.search);
  return params.get('trip') || null;
}

function setTripId(id) {
  const url = new URL(location.href);
  url.searchParams.set('trip', id);
  history.replaceState({}, '', url);
}

function renderWeekends(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  WEEKENDS.forEach((label, i) => {
    const div = document.createElement('div');
    div.className = 'weekend';
    div.innerHTML = `<input type="checkbox" id="w-${containerId}-${i}" value="${i}" /><span>${label}</span>`;
    div.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        const cb = div.querySelector('input');
        cb.checked = !cb.checked;
        div.classList.toggle('selected', cb.checked);
        updateSelectAllState();
      }
    });
    div.querySelector('input').addEventListener('change', () => {
      div.classList.toggle('selected', div.querySelector('input').checked);
      updateSelectAllState();
    });
    container.appendChild(div);
  });

  const selectAll = document.getElementById('select-all-weekends');
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('#weekends-me input[type="checkbox"]');
      const checked = selectAll.checked;
      checkboxes.forEach(cb => {
        cb.checked = checked;
        const row = cb.closest('.weekend');
        if (row) row.classList.toggle('selected', checked);
      });
    });
    var selectAllBlock = document.querySelector('.weekends-select-all');
    if (selectAllBlock) {
      selectAllBlock.addEventListener('click', function (e) {
        if (e.target.type === 'checkbox') return;
        e.preventDefault();
        selectAll.checked = !selectAll.checked;
        selectAll.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
  }
}

function updateSelectAllState() {
  const selectAll = document.getElementById('select-all-weekends');
  if (!selectAll) return;
  const checkboxes = document.querySelectorAll('#weekends-me input[type="checkbox"]');
  const total = checkboxes.length;
  const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
  selectAll.checked = total > 0 && checked === total;
  selectAll.indeterminate = checked > 0 && checked < total;
}

function getSelectedIndices() {
  return Array.from(document.querySelectorAll('#weekends-me input:checked'))
    .map(cb => parseInt(cb.value, 10))
    .sort((a, b) => a - b);
}

function setSelectedIndices(indices) {
  document.querySelectorAll('#weekends-me input').forEach(cb => {
    cb.checked = indices.includes(parseInt(cb.value, 10));
    cb.closest('.weekend').classList.toggle('selected', cb.checked);
  });
  updateSelectAllState();
}

async function createTrip() {
  if (!supabaseClient) {
    alert('Настрой Supabase: укажи SUPABASE_URL и SUPABASE_ANON_KEY в config.js');
    return;
  }
  const { data, error } = await supabaseClient.from('trips').insert({}).select('id').single();
  if (error) {
    alert('Не удалось создать поездку: ' + (error.message || JSON.stringify(error)));
    return;
  }
  setTripId(data.id);
  showTripScreen([]);
  document.getElementById('trip-url').value = location.href;
}

async function loadParticipants(tripId) {
  if (!supabaseClient || !tripId) return [];
  const { data, error } = await supabaseClient.from('participants').select('id, name, weekends').eq('trip_id', tripId);
  if (error) return [];
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    indices: (r.weekends || '').split(',').map(Number).filter(n => !isNaN(n))
  }));
}

async function deleteParticipant(tripId, participantId) {
  if (!supabaseClient || !tripId || !participantId) return false;
  var res = await supabaseClient
    .from('participants')
    .delete()
    .eq('id', participantId)
    .eq('trip_id', tripId)
    .select('id');
  if (res.error) {
    console.warn('deleteParticipant error:', res.error);
    return false;
  }
  return (res.data && res.data.length) > 0;
}

async function saveParticipant(tripId, name, indices) {
  if (!supabaseClient || !tripId) return;
  await supabaseClient.from('participants').insert({ trip_id: tripId, name, weekends: indices.join(',') });
}

function showTripScreen(participants) {
  document.getElementById('screen-no-trip').classList.remove('visible');
  document.getElementById('screen-trip').classList.add('visible');
  document.getElementById('trip-url').value = location.href;
  updateTripLinkVisibility(participants.length);
  renderParticipantsList(participants);
  renderBestResults(participants);
  initMapIfNeeded();
  loadMarkersAndDisplay(getTripId());
  renderMapMarkersList();
}

function formatParticipantDates(indices) {
  if (!indices.length) return '';
  var labels = indices.map(function (idx) { return WEEKENDS[idx] || ''; }).filter(Boolean);
  var byMonth = {};
  labels.forEach(function (label) {
    var lastSpace = label.lastIndexOf(' ');
    var dayPart = lastSpace >= 0 ? label.slice(0, lastSpace) : label;
    var month = lastSpace >= 0 ? label.slice(lastSpace + 1) : '';
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(dayPart);
  });
  return Object.keys(byMonth).map(function (month) {
    return byMonth[month].join(', ') + ' ' + month;
  }).join(', ');
}

function updateTripLinkVisibility(participantCount) {
  const wrap = document.querySelector('.trip-link-wrap');
  if (wrap) wrap.classList.toggle('hidden', participantCount > 0);
}

function renderParticipantsList(participants) {
  const ul = document.getElementById('participants-list');
  const tripId = getTripId();
  updateTripLinkVisibility(participants.length);
  if (participants.length === 0) {
    ul.innerHTML = '<li class="no-data">Пока никого. Добавь себя первым.</li>';
    return;
  }
  ul.innerHTML = participants.map((p) => `
    <li>
      <span class="participant-info"><span class="participant-name">${escapeHtml(p.name)}</span> <span class="participant-dates">${escapeHtml(formatParticipantDates(p.indices))}</span></span>
      <button type="button" class="btn-remove" data-id="${p.id}" title="Удалить" aria-label="Удалить">×</button>
    </li>
  `).join('');

  ul.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      var id = btn.getAttribute('data-id');
      if (!id) return;
      var deleted = await deleteParticipant(tripId, id);
      if (deleted) {
        try { await refreshTrip(); } catch (err) { console.warn('refreshTrip after delete:', err); }
      }
    });
  });
}

async function loadMarkers(tripId) {
  if (!supabaseClient || !tripId) return [];
  var res = await supabaseClient.from('markers').select('id, lat, lon, description').eq('trip_id', tripId);
  if (res.error) return [];
  return res.data || [];
}

async function saveMarker(tripId, lat, lon, description) {
  if (!supabaseClient || !tripId) return null;
  var row = { trip_id: tripId, lat: lat, lon: lon };
  if (description != null && String(description).trim() !== '') row.description = String(description).trim();
  var res = await supabaseClient.from('markers').insert(row).select('id').single();
  return res.error ? null : res.data.id;
}

async function deleteMarkerFromDb(tripId, markerId) {
  if (!supabaseClient || !tripId || !markerId) return;
  await supabaseClient.from('markers').delete().eq('id', markerId).eq('trip_id', tripId);
}

function initMapIfNeeded() {
  if (!window.YandexMap || !YANDEX_MAPS_API_KEY) return;
  if (window._tripMapInited) return;
  var container = document.getElementById('trip-map');
  if (!container) return;
  window._tripMapInited = true;
  var tripId = getTripId();
  window.YandexMap.init('trip-map', {
    apiKey: YANDEX_MAPS_API_KEY,
    center: [VOLGOGRAD.lat, VOLGOGRAD.lon],
    zoom: 10,
    onMapClick: function (coords) {
      if (!tripId) return;
      var draftId = 'draft_' + Date.now();
      window.YandexMap.addMarker(coords, {
        id: draftId,
        balloonContent: 'Введите описание ниже и нажмите ✓'
      });
    },
    onMarkersChange: renderMapMarkersList,
    onReady: function () {
      loadMarkersAndDisplay(getTripId());
    }
  });
}

async function loadMarkersAndDisplay(tripId) {
  if (!window.YandexMap) return;
  var markers = await loadMarkers(tripId);
  window.YandexMap.removeAllMarkers();
  markers.forEach(function (m) {
    var balloon = (m.description && m.description.trim()) ? m.description.trim() : 'Метка ' + m.lat.toFixed(5) + ', ' + m.lon.toFixed(5);
    window.YandexMap.addMarker([m.lat, m.lon], {
      id: m.id,
      balloonContent: balloon
    });
  });
}

function renderMapMarkersList() {
  var listEl = document.getElementById('map-markers-list');
  if (!listEl || !window.YandexMap) return;
  var markers = window.YandexMap.getMarkers();
  if (markers.length === 0) {
    listEl.innerHTML = '<li class="no-data">Нет меток. Кликни по карте выше.</li>';
    return;
  }
  var tripId = getTripId();
  listEl.innerHTML = markers.map(function (m) {
    var isDraft = m.id.indexOf('draft_') === 0;
    var lat = m.coords[0];
    var lon = m.coords[1];
    var coordsStr = lat.toFixed(5) + ', ' + lon.toFixed(5);
    if (isDraft) {
      return '<li class="map-marker-row map-marker-row--draft" data-marker-id="' + escapeHtml(m.id) + '" data-lat="' + lat + '" data-lon="' + lon + '">' +
        '<span class="map-marker-coords">' + escapeHtml(coordsStr) + '</span> ' +
        '<input type="text" class="map-marker-input" placeholder="Описание" maxlength="200" /> ' +
        '<button type="button" class="btn-save" title="Сохранить в базу">✓</button></li>';
    }
    var desc = (m.balloonContent && m.balloonContent.trim()) ? escapeHtml(m.balloonContent) : coordsStr;
    return '<li class="map-marker-row map-marker-row--clickable" data-marker-id="' + escapeHtml(m.id) + '" title="Показать на карте">' +
      '<span class="map-marker-desc">' + desc + '</span> ' +
      '<button type="button" class="btn-remove" data-marker-id="' + escapeHtml(m.id) + '" title="Удалить">×</button></li>';
  }).join('');

  listEl.querySelectorAll('.map-marker-row--clickable').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      var id = row.getAttribute('data-marker-id');
      if (id && window.YandexMap && window.YandexMap.focusMarker) window.YandexMap.focusMarker(id);
    });
  });
  listEl.querySelectorAll('.map-marker-row--draft').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.closest('button') || e.target.closest('input')) return;
      var id = row.getAttribute('data-marker-id');
      if (id && window.YandexMap && window.YandexMap.focusMarker) window.YandexMap.focusMarker(id);
    });
  });

  listEl.querySelectorAll('.btn-save').forEach(function (btn) {
    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      var li = btn.closest('li');
      var draftId = li.getAttribute('data-marker-id');
      var lat = parseFloat(li.getAttribute('data-lat'), 10);
      var lon = parseFloat(li.getAttribute('data-lon'), 10);
      var input = li.querySelector('.map-marker-input');
      var description = input ? input.value.trim() : '';
      var id = await saveMarker(tripId, lat, lon, description);
      if (id) {
        window.YandexMap.removeMarker(draftId);
        var balloon = description || ('Метка ' + lat.toFixed(5) + ', ' + lon.toFixed(5));
        window.YandexMap.addMarker([lat, lon], { id: id, balloonContent: balloon });
      }
    });
  });

  listEl.querySelectorAll('.btn-remove').forEach(function (btn) {
    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      var id = btn.getAttribute('data-marker-id');
      await deleteMarkerFromDb(tripId, id);
      window.YandexMap.removeMarker(id);
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function plural(n) {
  return n % 10 === 1 && n % 100 !== 11 ? 'человек' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'человека' : 'человек';
}

function calculateBest(people) {
  const byWeekend = WEEKENDS.map((label, i) => ({
    index: i,
    label,
    names: people.filter(p => p.indices.includes(i)).map(p => p.name),
    count: 0
  }));
  byWeekend.forEach(w => { w.count = w.names.length; });
  byWeekend.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.index - a.index; // при равном числе участников — позже дата выше
  });
  return byWeekend;
}

async function fetchWeather(weekendIndex) {
  const dates = getWeekendDatesForArchive();
  const d = dates[weekendIndex];
  if (!d) return { avgTemp: null, desc: null };
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${VOLGOGRAD.lat}&longitude=${VOLGOGRAD.lon}&start_date=${d.start}&end_date=${d.end}&daily=temperature_2m_mean,weathercode&timezone=Europe/Volgograd`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const temps = data.daily?.temperature_2m_mean || [];
    const codes = data.daily?.weathercode || [];
    const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : null;
    const mainCode = codes.length ? codes[0] : null;
    return { avgTemp, desc: mainCode != null ? weatherDesc(mainCode) : null };
  } catch (e) {
    return { avgTemp: null, desc: null };
  }
}

async function renderBestResults(participants) {
  const resultsEl = document.getElementById('results');
  if (participants.length === 0) {
    resultsEl.innerHTML = '<p class="no-data">Добавь участников — появятся все варианты выходных по удачности и погода в Волгограде.</p>';
    return;
  }
  const all = calculateBest(participants);
  const rankClass = (i) => (i === 0 ? 'best' : i === 1 ? 'second' : '');
  resultsEl.innerHTML = all.map((w, i) => `
    <div class="result-card ${rankClass(i)}" data-weekend-index="${w.index}">
      <h3>${escapeHtml(w.label)}</h3>
      <span class="count">${w.count} ${plural(w.count)}</span>
      <div class="weather-line weather-loading">Погода в Волгограде: загрузка…</div>
      <div class="names">${w.names.map(n => `<span>${escapeHtml(n)}</span>`).join('')}</div>
    </div>
  `).join('');

  all.forEach((w, i) => {
    const card = resultsEl.children[i];
    const weatherEl = card.querySelector('.weather-line');
    fetchWeather(w.index).then(({ avgTemp, desc }) => {
      weatherEl.classList.remove('weather-loading');
      if (avgTemp != null || desc) {
        const parts = [];
        if (avgTemp != null) parts.push(`<strong>средняя температура ${avgTemp} °C</strong>`);
        if (desc) parts.push(desc);
        weatherEl.innerHTML = 'Волгоград: ' + parts.join(', ');
      } else {
        weatherEl.textContent = 'Волгоград: данные за прошлый год недоступны';
      }
    });
  });
}

async function refreshTrip() {
  const tripId = getTripId();
  const participants = await loadParticipants(tripId);
  renderParticipantsList(participants);
  renderBestResults(participants);
}

document.getElementById('create-trip').addEventListener('click', createTrip);

document.getElementById('btn-add-me').addEventListener('click', async () => {
  const name = document.getElementById('name').value.trim();
  const indices = getSelectedIndices();
  if (!name) { alert('Напиши имя'); return; }
  if (indices.length === 0) { alert('Выбери хотя бы одни выходные'); return; }
  const tripId = getTripId();
  if (!tripId) { alert('Сначала открой ссылку на поездку'); return; }
  await saveParticipant(tripId, name, indices);
  document.getElementById('name').value = '';
  setSelectedIndices([]);
  await refreshTrip();
  const btn = document.getElementById('btn-add-me');
  const old = btn.textContent;
  btn.textContent = 'Добавлено!';
  setTimeout(() => { btn.textContent = old; }, 1500);
});

document.getElementById('copy-link').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('trip-url').value).then(() => {
    const btn = document.getElementById('copy-link');
    const old = btn.textContent;
    btn.textContent = 'Скопировано!';
    setTimeout(() => { btn.textContent = old; }, 1500);
  });
});

(async function init() {
  renderWeekends('weekends-me');
  const tripId = getTripId();
  if (tripId) {
    const participants = await loadParticipants(tripId);
    showTripScreen(participants);
  } else {
    document.getElementById('screen-trip').classList.remove('visible');
    document.getElementById('screen-no-trip').classList.add('visible');
  }
})();
