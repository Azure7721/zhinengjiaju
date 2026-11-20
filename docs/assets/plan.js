(function () {
  var DOCS = [
    {
      group: '总览',
      items: [
        ['index.html', '总览与导航'],
        ['00-全阶段开发计划.html', '00 · 全阶段开发计划']
      ]
    },
    {
      group: '架构与规格',
      items: [
        ['01-总体架构与技术选型.html', '01 · 总体架构与技术选型'],
        ['02-数据模型与接口契约.html', '02 · 数据模型与接口契约'],
        ['03-账号权限与家庭体系.html', '03 · 账号权限与家庭体系'],
        ['04-设备引擎与信号适配.html', '04 · 设备引擎与信号适配'],
        ['05-小程序用户端.html', '05 · 小程序用户端'],
        ['06-管理后台.html', '06 · 管理后台'],
        ['07-场景自动化与实时联动.html', '07 · 场景自动化与实时联动'],
        ['08-设备测试与蓝牙联调.html', '08 · 设备测试与蓝牙联调'],
        ['09-测试部署与演示.html', '09 · 测试部署与演示']
      ]
    },
    {
      group: '阶段计划',
      items: [
        ['phase-0-基础设施.html', 'P0 · 基础设施'],
        ['phase-1-账号与数据.html', 'P1 · 账号与数据'],
        ['phase-2-设备与场景.html', 'P2 · 设备与场景'],
        ['phase-3-小程序前台.html', 'P3 · 小程序前台'],
        ['phase-4-管理后台.html', 'P4 · 管理后台'],
        ['phase-5-联调与交付.html', 'P5 · 联调与交付']
      ]
    }
  ];

  var path = window.location.pathname.split('/').pop() || 'index.html';
  try { path = decodeURIComponent(path); } catch (e) {}
  if (path === '') path = 'index.html';

  function findTitle() {
    for (var g = 0; g < DOCS.length; g++) {
      for (var i = 0; i < DOCS[g].items.length; i++) {
        if (DOCS[g].items[i][0] === path) return DOCS[g].items[i][1];
      }
    }
    return '开发计划';
  }

  function buildSidebar() {
    var html = '';
    html += '<div class="brand">';
    html += '<div class="logo">SH</div>';
    html += '<div><b>全屋智能小程序</b><span>全阶段开发计划</span></div>';
    html += '</div>';
    DOCS.forEach(function (group) {
      html += '<div class="nav-group"><h4>' + group.group + '</h4>';
      group.items.forEach(function (item) {
        var active = item[0] === path ? ' class="active"' : '';
        html += '<a href="' + item[0] + '"' + active + '>' + item[1] + '</a>';
      });
      html += '</div>';
    });
    html += '<div class="side-note"><b>当前阶段</b>只产出计划文档，不写业务代码。';
    html += '<br><br><a href="../开发分析报告.html" style="color:#9fe1e3">← 返回产品与开发分析报告</a></div>';
    return html;
  }

  function buildTopbar() {
    var title = findTitle();
    return '<button class="menu-btn" id="menu-btn" aria-label="打开目录">☰</button>' +
      '<div class="crumb">全屋智能小程序 &nbsp;/&nbsp; <b>' + title + '</b></div>' +
      '<div class="spacer"></div>' +
      '<a class="top-btn" href="index.html">总览</a>' +
      '<button class="top-btn" id="print-btn">打印 / 导出 PDF</button>';
  }

  function init() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.innerHTML = buildSidebar();

    var topbar = document.getElementById('topbar');
    if (topbar) topbar.innerHTML = buildTopbar();

    var progress = document.createElement('div');
    progress.id = 'progress';
    document.body.appendChild(progress);

    var backdrop = document.createElement('div');
    backdrop.id = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    function closeMenu() {
      if (sidebar) sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    }

    var menuBtn = document.getElementById('menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        if (!sidebar) return;
        sidebar.classList.toggle('open');
        backdrop.classList.toggle('show');
      });
    }
    backdrop.addEventListener('click', closeMenu);
    if (sidebar) {
      sidebar.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeMenu);
      });
    }

    var printBtn = document.getElementById('print-btn');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

    function updateProgress() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
      progress.style.width = pct + '%';
    }
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    document.querySelectorAll('pre').forEach(function (pre) {
      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = '复制';
      btn.addEventListener('click', function () {
        var clone = pre.cloneNode(true);
        var b = clone.querySelector('.copy-btn');
        if (b) b.remove();
        var text = clone.textContent || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = '已复制';
            setTimeout(function () { btn.textContent = '复制'; }, 1200);
          });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); btn.textContent = '已复制'; } catch (e) {}
          document.body.removeChild(ta);
          setTimeout(function () { btn.textContent = '复制'; }, 1200);
        }
      });
      pre.appendChild(btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
