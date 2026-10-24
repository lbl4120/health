(function () {
  'use strict';

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  window.HealthChart = {
    render: function (records, target) {
      var el = document.getElementById('weightChart');
      if (!el || typeof echarts === 'undefined') return;

      if (!window.__weightChart) {
        window.__weightChart = echarts.init(el, null, { renderer: 'svg' });
      }
      var chart = window.__weightChart;

      var accent = cssVar('--accent');
      var accent2 = cssVar('--accent2');
      var muted = cssVar('--muted');
      var rule = cssVar('--rule');
      var bg2 = cssVar('--bg2');

      var labels = records.map(function (r) { return r.date.slice(5).replace('-', '/'); });
      var values = records.map(function (r) { return r.kg; });
      var all = values.concat([target]);
      var min = Math.floor(Math.min.apply(null, all) - 1);
      var max = Math.ceil(Math.max.apply(null, all) + 1);

      chart.setOption({
        animation: false,
        grid: { left: 36, right: 20, top: 26, bottom: 26 },
        tooltip: {
          trigger: 'axis',
          appendToBody: true,
          valueFormatter: function (v) { return v + ' kg'; }
        },
        xAxis: {
          type: 'category',
          data: labels,
          boundaryGap: false,
          axisLine: { lineStyle: { color: rule } },
          axisTick: { show: false },
          axisLabel: { color: muted, fontSize: 11 }
        },
        yAxis: {
          type: 'value',
          min: min,
          max: max,
          splitLine: { lineStyle: { color: rule, type: 'dashed' } },
          axisLabel: { color: muted, fontSize: 11 }
        },
        series: [{
          type: 'line',
          smooth: 0.35,
          data: values,
          symbol: 'circle',
          symbolSize: 7,
          itemStyle: { color: accent, borderColor: bg2, borderWidth: 2 },
          lineStyle: { color: accent, width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: accent + '55' },
              { offset: 1, color: accent + '05' }
            ])
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              formatter: '目标 ' + target,
              color: accent2,
              fontSize: 11,
              position: 'insideEndTop'
            },
            lineStyle: { color: accent2, type: 'dashed', width: 1 },
            data: [{ yAxis: target }]
          }
        }]
      }, true);
    }
  };

  window.addEventListener('resize', function () {
    if (window.__weightChart) window.__weightChart.resize();
  });
})();
