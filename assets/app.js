(function () {
  'use strict';

  var DATA = JSON.parse(document.getElementById('menuData').textContent);
  var P = DATA.profile;
  var KEY = 'health-workbench-v1';
  var WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDate(d) {
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + WD[d.getDay()];
  }

  var today = new Date();
  var todayKey = iso(today);

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : { weights: [], days: {} };
      }
    } catch (e) { /* 隐私模式下不可用，退化为内存状态 */ }
    return { weights: [], days: {} };
  }

  var state = loadState();
  if (!state.weights || !state.weights.length) {
    state.weights = [{ date: DATA.week_start, kg: P.start_weight_kg }];
  }
  if (!state.days) state.days = {};

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function dayRecord() {
    if (!state.days[todayKey]) {
      state.days[todayKey] = { walk: false, meal: false, nosugar: false, sleep: false, water: 0 };
    }
    return state.days[todayKey];
  }

  /* ---------- 今日三餐 ---------- */
  var menuIndex = 0;
  DATA.days.forEach(function (d, i) {
    if (d.weekday === WD[today.getDay()]) menuIndex = i;
  });
  var todayMenu = DATA.days[menuIndex];

  function dish(k, v) {
    return '<div class="dish"><span class="dish-k">' + k + '</span><span class="dish-v">' + v + '</span></div>';
  }

  function avoidChips(list) {
    if (!list || !list.length) return '';
    return '<div class="avoid">' + list.map(function (x) {
      return '<span class="chip">' + x + '</span>';
    }).join('') + '</div>';
  }

  function mealHTML(meal) {
    return dish('主荤', meal.main) + dish('配菜', meal.side) +
      dish('青菜', meal.veg) + dish('主食', meal.carb) +
      avoidChips(meal.avoid) + '<p class="tip">' + meal.tip + '</p>';
  }

  function renderToday() {
    document.getElementById('todayLabel').textContent = fmtDate(today);
    document.getElementById('weekTag').textContent = '本周菜单 · ' + todayMenu.weekday;
    document.getElementById('mealLunch').innerHTML = mealHTML(todayMenu.lunch);
    document.getElementById('mealDinner').innerHTML = mealHTML(todayMenu.dinner);
    document.getElementById('mealSnack').innerHTML =
      '<div class="dish"><span class="dish-v">' + todayMenu.snack + '</span></div>' +
      '<p class="tip">15:20 前吃完，防 17:30 下班饿到吃多。</p>';
  }

  /* ---------- 打卡 ---------- */
  var TASK_KEYS = ['walk', 'meal', 'nosugar', 'sleep'];

  function taskDone(rec) {
    return TASK_KEYS.filter(function (k) { return rec[k]; }).length;
  }

  function isGoodDay(rec) {
    return !!rec && taskDone(rec) >= 3;
  }

  function streakDays() {
    var d = new Date(today);
    if (!isGoodDay(state.days[iso(d)])) d.setDate(d.getDate() - 1);
    var count = 0;
    while (isGoodDay(state.days[iso(d)])) {
      count += 1;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  function syncTasks() {
    var rec = dayRecord();
    document.querySelectorAll('#taskList input').forEach(function (cb) {
      var on = !!rec[cb.dataset.task];
      cb.checked = on;
      cb.closest('.task').classList.toggle('done', on);
    });
    var done = taskDone(rec);
    document.getElementById('taskCount').textContent = done + ' / 4';
    document.getElementById('taskBar').style.width = (done / 4 * 100) + '%';
    document.getElementById('kStreak').innerHTML = streakDays() + '<small>天</small>';
    document.getElementById('kStreakSub').textContent = done >= 3 ? '今天已达标' : '今天还差 ' + (3 - done) + ' 项';
  }

  function initTasks() {
    document.querySelectorAll('#taskList input').forEach(function (cb) {
      cb.addEventListener('change', function () {
        dayRecord()[cb.dataset.task] = cb.checked;
        save();
        syncTasks();
      });
    });
  }

  /* ---------- 饮水 ---------- */
  function syncWater() {
    var rec = dayRecord();
    var cups = document.getElementById('cups').children;
    for (var i = 0; i < cups.length; i++) {
      cups[i].classList.toggle('on', i < rec.water);
    }
    document.getElementById('waterLabel').textContent = rec.water + ' / 8 杯';
  }

  function initCups() {
    var box = document.getElementById('cups');
    for (var i = 0; i < 8; i++) {
      var cup = document.createElement('button');
      cup.type = 'button';
      cup.className = 'cup';
      cup.setAttribute('aria-label', '第 ' + (i + 1) + ' 杯水');
      (function (idx) {
        cup.addEventListener('click', function () {
          var rec = dayRecord();
          rec.water = rec.water === idx ? idx - 1 : idx;
          save();
          syncWater();
        });
      })(i + 1);
      box.appendChild(cup);
    }
  }

  /* ---------- 体重 ---------- */
  function sortedWeights() {
    return state.weights.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  function latestWeight() {
    var list = sortedWeights();
    return list[list.length - 1] || { date: DATA.week_start, kg: P.start_weight_kg };
  }

  function bmiLabel(bmi) {
    if (bmi >= 28) return '肥胖区间';
    if (bmi >= 24) return '超重区间';
    if (bmi >= 18.5) return '正常区间';
    return '偏瘦';
  }

  function renderStats() {
    var latest = latestWeight();
    var diff = latest.kg - P.start_weight_kg;
    var toTarget = latest.kg - P.target_weight_kg;

    document.getElementById('kWeight').innerHTML = latest.kg.toFixed(1) + '<small>kg</small>';
    document.getElementById('kWeightSub').textContent =
      diff < 0 ? '较起点 ' + diff.toFixed(1) + ' kg' : '起点 ' + P.start_weight_kg + ' kg';

    if (toTarget <= 0) {
      document.getElementById('kTarget').innerHTML = '达成<small></small>';
      document.getElementById('kTargetSub').textContent = '已到目标体重';
    } else {
      document.getElementById('kTarget').innerHTML = toTarget.toFixed(1) + '<small>kg</small>';
      document.getElementById('kTargetSub').textContent = '目标 ' + P.target_weight_kg + ' kg';
    }

    var bmi = latest.kg / Math.pow(P.height_cm / 100, 2);
    document.getElementById('kBmi').innerHTML = bmi.toFixed(1);
    document.getElementById('kBmiSub').textContent = bmiLabel(bmi);

    var recent = sortedWeights().slice(-7);
    var sum = recent.reduce(function (acc, item) { return acc + item.kg; }, 0);
    var avg = sum / recent.length;
    document.getElementById('avgLabel').textContent =
      '近 ' + recent.length + ' 次平均 ' + avg.toFixed(2) + ' kg · 只看平均值，单日波动是水分';

    if (window.HealthChart) {
      window.HealthChart.render(sortedWeights(), P.target_weight_kg);
    }
  }

  function initWeightForm() {
    var dateInput = document.getElementById('weightDate');
    var kgInput = document.getElementById('weightKg');
    dateInput.value = todayKey;
    dateInput.max = todayKey;

    document.getElementById('weightForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var date = dateInput.value;
      var kg = parseFloat(kgInput.value);
      if (!date || !isFinite(kg) || kg < 30 || kg > 200) return;

      var index = -1;
      for (var i = 0; i < state.weights.length; i++) {
        if (state.weights[i].date === date) { index = i; break; }
      }
      if (index >= 0) state.weights[index].kg = kg;
      else state.weights.push({ date: date, kg: kg });
      state.weights.sort(function (a, b) { return a.date < b.date ? -1 : 1; });

      save();
      renderStats();
      kgInput.value = '';
    });
  }

  /* ---------- 本周菜单 ---------- */
  function menuBlock(title, meal) {
    return '<div class="menu-block"><h3>' + title + '</h3>' +
      dish('主荤', meal.main) + dish('配菜', meal.side) +
      dish('青菜', meal.veg) + dish('主食', meal.carb) +
      avoidChips(meal.avoid) + '</div>';
  }

  function renderMenu(index) {
    var day = DATA.days[index];
    document.getElementById('menuDetail').innerHTML =
      menuBlock('午餐', day.lunch) + menuBlock('晚餐', day.dinner) +
      '<p class="tip" style="grid-column:1/-1">' + day.workout + '</p>';
    document.querySelectorAll('#menuTabs .tab').forEach(function (tab, i) {
      tab.classList.toggle('active', i === index);
    });
  }

  function initMenu() {
    var tabs = document.getElementById('menuTabs');
    DATA.days.forEach(function (day, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.textContent = day.weekday;
      btn.addEventListener('click', function () { renderMenu(i); });
      tabs.appendChild(btn);
    });
    renderMenu(menuIndex);
  }

  /* ---------- 启动 ---------- */
  renderToday();
  initTasks();
  syncTasks();
  initCups();
  syncWater();
  initWeightForm();
  renderStats();
  initMenu();

  window.addEventListener('focus', function () {
    var now = new Date();
    if (iso(now) !== todayKey) {
      today = now;
      todayKey = iso(now);
      renderToday();
      syncTasks();
      syncWater();
      renderStats();
    }
  });
})();
