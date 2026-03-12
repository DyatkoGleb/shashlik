/**
 * Конфигурация приложения. Настрой Supabase и ключ карт здесь.
 */
(function (global) {
  'use strict';

  // Supabase: создай проект на supabase.com, вставь URL и anon key (Settings → API)
  global.SUPABASE_URL = 'https://mtyazmihdcskgxuqobyr.supabase.co';
  global.SUPABASE_ANON_KEY = ''; // anon public key (JWT, начинается с eyJ)

  // Яндекс.Карты: developer.tech.yandex.ru → JavaScript API. Без ключа карта не загрузится.
  global.YANDEX_MAPS_API_KEY = '2b869f46-c097-4f90-8aa0-6ecca1cfb1cc';

  // Выходные для выбора (середина апреля — конец мая)
  global.WEEKENDS = [
    '18–19 апреля',
    '25–26 апреля',
    '2–3 мая',
    '9–10 мая',
    '16–17 мая',
    '23–24 мая'
  ];

  // Координаты для погоды и центра карты (Волгоград)
  global.VOLGOGRAD = { lat: 48.708, lon: 44.513 };

  // Описание погоды по кодам WMO (Open-Meteo)
  global.WMO_WEATHER = {
    0: 'ясно', 1: 'преим. ясно', 2: 'переменная облачность', 3: 'пасмурно',
    45: 'туман', 48: 'изморозь', 51: 'морось', 53: 'морось', 55: 'морось',
    61: 'дождь', 63: 'дождь', 65: 'сильный дождь', 71: 'снег', 73: 'снег', 75: 'снег',
    80: 'ливень', 81: 'ливень', 82: 'ливень', 95: 'гроза', 96: 'гроза с градом', 99: 'гроза с градом'
  };
})(typeof window !== 'undefined' ? window : this);
