const cityInput = document.getElementById('city-input');
const resultsEl = document.getElementById('city-results');
const statusEl = document.getElementById('status');
const resultCity = document.getElementById('result-city');
const resultDate = document.getElementById('result-date');
const resultTemp = document.getElementById('result-temp');
const resultRange = document.getElementById('result-range');
const resultSummary = document.getElementById('result-summary');
const resultOutfit = document.getElementById('result-outfit');
const resultTips = document.getElementById('result-tips');
const feelsMeta = document.getElementById('feels-meta');
const quickSeoulBtn = document.getElementById('use-seoul');

const genderButtons = document.querySelectorAll('.toggle-btn');

const state = {
  gender: 'female',
  city: null,
  forecast: null,
  loading: false,
  results: [],
  activeIndex: -1,
};

const weatherCodeMap = {
  0: '맑음',
  1: '대체로 맑음',
  2: '부분적으로 흐림',
  3: '흐림',
  45: '안개',
  48: '착빙 안개',
  51: '약한 이슬비',
  53: '이슬비',
  55: '강한 이슬비',
  56: '약한 어는 이슬비',
  57: '강한 어는 이슬비',
  61: '약한 비',
  63: '비',
  65: '강한 비',
  66: '약한 어는 비',
  67: '강한 어는 비',
  71: '약한 눈',
  73: '눈',
  75: '강한 눈',
  77: '싸락눈',
  80: '약한 소나기',
  81: '소나기',
  82: '강한 소나기',
  85: '약한 눈 소나기',
  86: '강한 눈 소나기',
  95: '천둥번개',
  96: '우박 동반 천둥번개',
  99: '강한 우박 동반 천둥번개',
};

function calcFeelsLike(temp, windKmh, precipPercent) {
  let feels = temp;

  if (temp <= 10) {
    const windMs = windKmh / 3.6;
    feels = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windMs, 0.16) + 0.3965 * temp * Math.pow(windMs, 0.16);
  } else if (temp >= 24) {
    // Humidity unavailable; use precip probability as a rough proxy.
    const humidity = Math.min(Math.max(precipPercent, 30), 85);
    feels = temp + 0.05 * (humidity - 50);
  }

  return feels;
}

const outfitRanges = [
  { min: 28, label: '한여름', female: ['민소매 또는 얇은 반팔', '린넨 셔츠/원피스', '숏팬츠 또는 가벼운 스커트', '샌들/뮬'], male: ['반팔 티셔츠', '린넨 셔츠', '숏팬츠', '샌들/슬립온'] },
  { min: 23, max: 27, label: '초여름', female: ['반팔/얇은 블라우스', '가벼운 와이드 팬츠', '얇은 가디건(실내 대비)'], male: ['반팔 셔츠/티', '면 팬츠', '얇은 셔츠 아우터'] },
  { min: 20, max: 22, label: '따뜻', female: ['긴팔 티/셔츠', '얇은 니트', '가벼운 재킷'], male: ['긴팔 티/셔츠', '가벼운 니트', '얇은 자켓'] },
  { min: 17, max: 19, label: '선선', female: ['니트/맨투맨', '트렌치나 얇은 코트'], male: ['맨투맨/니트', '가벼운 바람막이'] },
  { min: 12, max: 16, label: '쌀쌀', female: ['자켓/가디건', '긴바지', '얇은 머플러'], male: ['자켓', '긴바지', '얇은 머플러'] },
  { min: 9, max: 11, label: '초겨울', female: ['코트', '니트', '레깅스 또는 두꺼운 팬츠'], male: ['코트', '니트', '두꺼운 팬츠'] },
  { min: 5, max: 8, label: '춥다', female: ['두꺼운 코트', '니트/기모', '히트텍 레이어드'], male: ['두꺼운 코트', '기모 상의', '히트텍 레이어드'] },
  { max: 4, label: '한겨울', female: ['롱패딩', '두꺼운 니트', '방한 부츠'], male: ['롱패딩', '두꺼운 니트', '방한 부츠'] },
];

function setStatus(message) {
  statusEl.textContent = message;
}

function clearResults() {
  resultsEl.innerHTML = '';
  state.results = [];
  state.activeIndex = -1;
  cityInput.setAttribute('aria-expanded', 'false');
  cityInput.removeAttribute('aria-activedescendant');
}

function createResultItem(city, index) {
  const button = document.createElement('button');
  button.className = 'result-item';
  button.type = 'button';
  button.id = `city-option-${index}`;
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', 'false');

  const nameEl = document.createElement('strong');
  nameEl.textContent = city.name;
  const metaEl = document.createElement('small');
  metaEl.textContent = `${city.admin1 || ''} ${city.admin2 || ''}`.trim();
  button.appendChild(nameEl);
  if (metaEl.textContent) {
    button.appendChild(metaEl);
  }
  button.addEventListener('click', () => {
    selectCity(city);
  });
  return button;
}

async function searchCities(query) {
  if (!query || query.length < 2) {
    clearResults();
    return;
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=ko&format=json&countryCode=KR`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('City search failed');
    }
    const data = await response.json();
    clearResults();

    if (!data.results || data.results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'result-item';
      empty.setAttribute('role', 'option');
      empty.setAttribute('aria-disabled', 'true');
      empty.textContent = '검색 결과가 없습니다.';
      resultsEl.appendChild(empty);
      cityInput.setAttribute('aria-expanded', 'true');
      return;
    }

    state.results = data.results;
    data.results.forEach((city, index) => {
      resultsEl.appendChild(createResultItem(city, index));
    });
    cityInput.setAttribute('aria-expanded', 'true');
  } catch (error) {
    clearResults();
    const err = document.createElement('div');
    err.className = 'result-item';
    err.setAttribute('role', 'option');
    err.setAttribute('aria-disabled', 'true');
    err.textContent = '도시 검색 중 오류가 발생했습니다.';
    resultsEl.appendChild(err);
    cityInput.setAttribute('aria-expanded', 'true');
  }
}

function selectCity(city) {
  state.city = city;
  cityInput.value = `${city.name}${city.admin1 ? `, ${city.admin1}` : ''}`;
  clearResults();
  fetchForecast();
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split('-');
  return `${year}.${month}.${day} (KST)`;
}

function pickOutfit(avgTemp, gender) {
  const range = outfitRanges.find((item) => {
    if (item.min !== undefined && item.max !== undefined) {
      return avgTemp >= item.min && avgTemp <= item.max;
    }
    if (item.min !== undefined) {
      return avgTemp >= item.min;
    }
    if (item.max !== undefined) {
      return avgTemp <= item.max;
    }
    return false;
  });

  if (!range) {
    return ['기온 정보를 불러오지 못했습니다.'];
  }

  const list = gender === 'female' ? range.female : range.male;
  return [`${range.label} 체감`, ...list];
}

function renderOutfit(items) {
  resultOutfit.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    resultOutfit.appendChild(li);
  });
}

function renderTips({ precipitation, wind, minTemp, maxTemp }) {
  resultTips.innerHTML = '';
  const tips = [];

  if (precipitation >= 50) {
    tips.push('우산 또는 방수 아우터 챙기기');
  }

  if (wind >= 25) {
    tips.push('바람이 강해 바람막이나 스카프 추천');
  }

  if (minTemp <= 5) {
    tips.push('아침/밤 기온이 낮아 레이어드 추천');
  }

  if (maxTemp >= 28) {
    tips.push('햇볕이 강하니 선크림/모자 준비');
  }

  if (tips.length === 0) {
    tips.push('큰 이슈 없이 편하게 입어도 좋아요');
  }

  tips.forEach((tip) => {
    const li = document.createElement('li');
    li.textContent = tip;
    resultTips.appendChild(li);
  });
}

async function fetchForecast() {
  if (!state.city) return;

  state.loading = true;
  setStatus('내일 날씨를 불러오는 중...');

  const { latitude, longitude } = state.city;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=Asia%2FSeoul&forecast_days=3&temperature_unit=celsius&wind_speed_unit=kmh`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Forecast fetch failed');
    }
    const data = await response.json();
    state.forecast = data;
    updateResult();
  } catch (error) {
    setStatus('날씨 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    state.loading = false;
  }
}

function updateResult() {
  if (!state.city || !state.forecast) return;

  const daily = state.forecast.daily;
  const tomorrowIndex = 1;

  if (!daily || !daily.time || !daily.time[tomorrowIndex]) {
    setStatus('내일 날씨 데이터를 찾을 수 없습니다.');
    return;
  }

  const date = daily.time[tomorrowIndex];
  const maxTemp = daily.temperature_2m_max[tomorrowIndex];
  const minTemp = daily.temperature_2m_min[tomorrowIndex];
  const precip = daily.precipitation_probability_max[tomorrowIndex];
  const wind = daily.wind_speed_10m_max[tomorrowIndex];
  const weatherCode = daily.weather_code[tomorrowIndex];

  const avgTemp = (maxTemp + minTemp) / 2;
  const feelsLike = calcFeelsLike(avgTemp, wind ?? 0, precip ?? 0);
  const outfit = pickOutfit(feelsLike, state.gender);

  resultCity.textContent = `${state.city.name}${state.city.admin1 ? ` · ${state.city.admin1}` : ''}`;
  resultDate.textContent = formatDate(date);
  resultTemp.textContent = `${Math.round(feelsLike)}°`;
  resultRange.textContent = `체감 기준 · 실제 최고 ${Math.round(maxTemp)}° / 최저 ${Math.round(minTemp)}°`;

  const condition = weatherCodeMap[weatherCode] || '날씨 정보';
  resultSummary.textContent = `${condition} · 강수확률 ${precip ?? 0}% · 최대 풍속 ${Math.round(wind ?? 0)} km/h`;
  feelsMeta.textContent = `체감 온도는 바람(추위)과 습도(더위)를 고려해 계산했어요.`;

  renderOutfit(outfit);
  renderTips({ precipitation: precip ?? 0, wind: wind ?? 0, minTemp, maxTemp });

  setStatus('내일 추천이 준비됐어요.');
}

function handleGenderToggle(event) {
  const button = event.currentTarget;
  const gender = button.dataset.gender;
  state.gender = gender;

  genderButtons.forEach((btn) => {
    const isActive = btn.dataset.gender === gender;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  if (state.forecast) {
    updateResult();
  }
}

let searchTimeout;
cityInput.addEventListener('input', (event) => {
  const query = event.target.value.trim();
  window.clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(() => searchCities(query), 250);
});

cityInput.addEventListener('focus', () => {
  const query = cityInput.value.trim();
  if (query.length >= 2) {
    searchCities(query);
  }
});

cityInput.addEventListener('keydown', (event) => {
  if (state.results.length === 0) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.activeIndex = (state.activeIndex + 1) % state.results.length;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.activeIndex = (state.activeIndex - 1 + state.results.length) % state.results.length;
  } else if (event.key === 'Enter') {
    if (state.activeIndex >= 0) {
      event.preventDefault();
      selectCity(state.results[state.activeIndex]);
    }
  } else if (event.key === 'Escape') {
    clearResults();
    return;
  } else {
    return;
  }

  const options = resultsEl.querySelectorAll('[role=\"option\"]');
  options.forEach((option, index) => {
    const isActive = index === state.activeIndex;
    option.setAttribute('aria-selected', String(isActive));
    if (isActive) {
      cityInput.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });
});

quickSeoulBtn.addEventListener('click', () => {
  selectCity({
    name: '서울',
    admin1: '서울특별시',
    latitude: 37.5665,
    longitude: 126.978,
  });
});

genderButtons.forEach((button) => {
  button.addEventListener('click', handleGenderToggle);
});

setStatus('도시를 선택하면 내일 추천이 나타납니다.');
