/**
 * Модуль Яндекс.Карты: карта с возможностью ставить и удалять метки.
 * Подключи скрипт API в HTML: <script src="https://api-maps.yandex.ru/2.1/?apikey=ТВОЙ_КЛЮЧ&lang=ru_RU"></script>
 * Либо передай apiKey в init() — тогда скрипт подгрузится сам.
 */
(function (global) {
  'use strict';

  var YANDEX_MAPS_SCRIPT = 'https://api-maps.yandex.ru/2.1/?apikey=';
  var DEFAULT_CENTER = [48.708, 44.513]; // Волгоград
  var DEFAULT_ZOOM = 10;

  var map = null;
  var placemarksById = {};
  var nextId = 1;
  var onMarkersChange = null;
  var pendingInit = null;

  function generateId() {
    return 'pm_' + (nextId++);
  }

  function createMap(containerId, options) {
    if (typeof ymaps === 'undefined') {
      pendingInit = { containerId: containerId, options: options || {} };
      return;
    }
    var opts = options || {};
    var center = opts.center || DEFAULT_CENTER;
    var zoom = opts.zoom !== undefined ? opts.zoom : DEFAULT_ZOOM;
    map = new ymaps.Map(containerId, {
      center: center,
      zoom: zoom,
      controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    if (opts.onMapClick) {
      map.events.add('click', function (e) {
        var coords = e.get('coords');
        if (coords) opts.onMapClick([coords[0], coords[1]]);
      });
    }
    onMarkersChange = opts.onMarkersChange || null;
  }

  function loadScript(apiKey, callback) {
    if (typeof ymaps !== 'undefined') {
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = YANDEX_MAPS_SCRIPT + encodeURIComponent(apiKey) + '&lang=ru_RU';
    script.async = true;
    script.onload = function () {
      ymaps.ready(function () {
        callback();
        if (pendingInit) {
          createMap(pendingInit.containerId, pendingInit.options);
          pendingInit = null;
        }
      });
    };
    script.onerror = function () {
      if (callback) callback(new Error('Yandex Maps script failed to load'));
    };
    document.head.appendChild(script);
  }

  /**
   * Инициализация карты.
   * @param {string} containerId - id элемента-контейнера для карты
   * @param {Object} options - center [lat, lon], zoom, apiKey (если не подключали скрипт в HTML), onMapClick(coords), onMarkersChange()
   */
  function init(containerId, options) {
    var opts = options || {};
    function done() {
      createMap(containerId, opts);
      if (opts.onReady && typeof opts.onReady === 'function') opts.onReady();
    }
    if (opts.apiKey) {
      loadScript(opts.apiKey, function (err) {
        if (err) {
          console.warn('YandexMap init error:', err);
          return;
        }
        done();
      });
    } else {
      done();
    }
  }

  /**
   * Добавить метку на карту.
   * @param {number[]} coords - [широта, долгота]
   * @param {Object} opts - balloonContent, hintContent, onMarkerClick(id)
   * @returns {string} id метки
   */
  function addMarker(coords, opts) {
    if (!map || typeof ymaps === 'undefined') return null;
    opts = opts || {};
    var id = opts.id || generateId();
    var balloonContent = opts.balloonContent || 'Метка';
    var hintContent = opts.hintContent || 'Клик — удалить';

    var placemark = new ymaps.Placemark(
      coords,
      {
        balloonContent: balloonContent,
        hintContent: hintContent,
        markerId: id
      },
      {
        draggable: false,
        preset: 'islands#redIcon'
      }
    );

    placemarksById[id] = { placemark: placemark, coords: coords, balloonContent: balloonContent };
    map.geoObjects.add(placemark);

    placemark.events.add('click', function () {
      if (opts.onMarkerClick) opts.onMarkerClick(id);
    });

    if (onMarkersChange) onMarkersChange();
    return id;
  }

  /**
   * Удалить метку по id.
   * @param {string} id
   */
  function removeMarker(id) {
    var rec = placemarksById[id];
    if (!rec || !map) return;
    map.geoObjects.remove(rec.placemark);
    delete placemarksById[id];
    if (onMarkersChange) onMarkersChange();
  }

  /**
   * Приблизить карту к метке и открыть её балун.
   * @param {string} id - id метки
   * @param {number} [zoomLevel=15] - уровень зума (больше = ближе)
   */
  function focusMarker(id, zoomLevel) {
    var rec = placemarksById[id];
    if (!rec || !map) return;
    var z = zoomLevel != null ? zoomLevel : 15;
    map.setCenter(rec.coords, z, { duration: 300 });
    rec.placemark.balloon.open();
  }

  /**
   * Удалить все метки.
   */
  function removeAllMarkers() {
    if (!map) return;
    var ids = Object.keys(placemarksById);
    for (var i = 0; i < ids.length; i++) {
      map.geoObjects.remove(placemarksById[ids[i]].placemark);
    }
    placemarksById = {};
    if (onMarkersChange) onMarkersChange();
  }

  /**
   * Список всех меток: [{ id, coords, balloonContent }, ...]
   */
  function getMarkers() {
    var list = [];
    for (var id in placemarksById) {
      if (placemarksById.hasOwnProperty(id)) {
        list.push({
          id: id,
          coords: placemarksById[id].coords,
          balloonContent: placemarksById[id].balloonContent
        });
      }
    }
    return list;
  }

  /**
   * Уничтожить карту и очистить метки.
   */
  function destroy() {
    if (map) {
      removeAllMarkers();
      map.destroy();
      map = null;
    }
    placemarksById = {};
    onMarkersChange = null;
  }

  global.YandexMap = {
    init: init,
    addMarker: addMarker,
    removeMarker: removeMarker,
    removeAllMarkers: removeAllMarkers,
    getMarkers: getMarkers,
    focusMarker: focusMarker,
    destroy: destroy
  };
})(typeof window !== 'undefined' ? window : this);
