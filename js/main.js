// ============================================================
// تفكيك الساعة إطاراً بإطار حسب السكرول.
// 105 إطار (720×1280) مستخرجة من الفيديو في assets/frames.
// موضع السكرول داخل المشهد ← رقم إطار صحيح يُرسم على canvas (بلا تنعيم ولا
// استيفاء): نزولاً تتفكك الساعة، صعوداً تلتئم.
// ============================================================
(function () {
  'use strict'

  var FRAME_COUNT = 105
  var FRAME_W = 720
  var FRAME_H = 1280
  var BG = '#ebe7e1'
  var FRAMES_END = 0.8 // جزء السكرول الذي تُعرض فيه الإطارات؛ الباقي يثبت على المنظر المفكك
  function frameSrc(i) { return 'assets/frames/' + String(i + 1).padStart(3, '0') + '.webp' }

  // تسميات القطع: y = موضعها العمودي في الإطار (%)، edge = حافة القطعة أفقياً (%)
  var PARTS = [
    { y: 7, edge: 66, side: 'r', title: 'زجاج كريستالي', sub: 'مقاوم للخدوش' },
    { y: 14.5, edge: 37, side: 'l', title: 'إطار ذهبي مصقول', sub: 'لمعان يدوم' },
    { y: 25, edge: 66, side: 'r', title: 'ميناء أسود مشمّس', sub: 'مؤشرات ذهبية رفيعة' },
    { y: 41, edge: 39, side: 'l', title: 'حركة دقيقة', sub: 'دقة في كل ثانية' },
    { y: 73.5, edge: 72, side: 'r', title: 'حزام جلد طبيعي', sub: 'راحة وأناقة' },
    { y: 75, edge: 49, side: 'l', title: 'تاج التعبئة', sub: 'ضبط سلس للوقت' },
    { y: 86, edge: 66, side: 'r', title: 'غطاء فولاذي', sub: 'فولاذ مقاوم للصدأ' },
    { y: 94, edge: 40, side: 'l', title: 'حلقة عزل', sub: 'مقاومة للماء 3 ATM' }
  ]

  var section = document.getElementById('scene')
  var canvas = document.getElementById('sceneCanvas')
  var box = document.getElementById('sceneBox')
  var loader = document.getElementById('sceneLoader')
  var ctx = canvas.getContext('2d')

  // ── التسميات ──
  var fades = [] // [element, a, b, c, d, isPart]
  PARTS.forEach(function (part, idx) {
    var el = document.createElement('div')
    el.className = 'part part--' + part.side
    el.style.top = part.y + '%'
    if (part.side === 'r') { el.style.left = part.edge + '%'; el.style.right = 'calc(-1 * var(--ext))' }
    else { el.style.right = (100 - part.edge) + '%'; el.style.left = 'calc(-1 * var(--ext))' }
    el.innerHTML = '<span class="part__dot"></span><span class="part__line"></span>' +
      '<span class="part__label"><span class="part__title"></span><span class="part__sub"></span></span>'
    el.querySelector('.part__title').textContent = part.title
    el.querySelector('.part__sub').textContent = part.sub
    box.appendChild(el)
    var start = 0.5 + idx * 0.035
    fades.push([el, start, start + 0.06, undefined, undefined, true])
  })
  document.querySelectorAll('[data-fade]').forEach(function (el) {
    var v = el.getAttribute('data-fade').split(',').map(Number)
    fades.push([el, v[0], v[1], v[2], v[3], false])
  })

  function applyFades(p) {
    for (var k = 0; k < fades.length; k++) {
      var f = fades[k]
      var o = (p - f[1]) / (f[2] - f[1])
      if (f[3] !== undefined) o = Math.min(o, (f[4] - p) / (f[4] - f[3]))
      o = Math.max(0, Math.min(1, o))
      if (f[5]) {
        f[0].style.opacity = o
        f[0].style.transform = 'translateY(calc(-50% + ' + ((1 - o) * 14) + 'px))'
      } else {
        f[0].style.setProperty('--o', o)
      }
    }
  }

  // ── الرسم ──
  var images = []
  var ready = []
  var readyCount = 0
  var drawn = -1
  var wanted = 0
  var raf = 0
  var rect = { x: 0, y: 0, w: 0, h: 0, cw: 0, ch: 0, dpr: 1 }

  // الخلفية حول الإطار: wall.png صورة صغيرة (18×32) لجدار الفيديو بدون الساعة،
  // تُمدّد حواف الإطار إلى أطراف الشاشة فلا يظهر أي خط عند حدوده.
  var plate = new Image()
  var plateReady = false
  var bgLayer = document.createElement('canvas')
  var frameLayer = document.createElement('canvas')
  var maskLayer = document.createElement('canvas')
  var feathered = false

  function renderBackground() {
    bgLayer.width = canvas.width
    bgLayer.height = canvas.height
    var b = bgLayer.getContext('2d')
    b.setTransform(rect.dpr, 0, 0, rect.dpr, 0, 0)
    b.fillStyle = BG
    b.fillRect(0, 0, rect.cw, rect.ch)
    if (!plateReady) return
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h, pw = plate.width, ph = plate.height
    b.imageSmoothingQuality = 'high'
    b.drawImage(plate, x, y, w, h)
    if (x > 0) {
      b.drawImage(plate, 0.25, 0, 0.5, ph, 0, y, x + 1, h)
      b.drawImage(plate, pw - 0.75, 0, 0.5, ph, x + w - 1, y, rect.cw - x - w + 1, h)
    }
    if (y > 0) {
      b.drawImage(plate, 0, 0.25, pw, 0.5, x, 0, w, y + 1)
      b.drawImage(plate, 0, ph - 0.75, pw, 0.5, x, y + h - 1, w, rect.ch - y - h + 1)
    }
  }

  function renderMask() {
    var W = Math.round(rect.w * rect.dpr), H = Math.round(rect.h * rect.dpr)
    frameLayer.width = maskLayer.width = W
    frameLayer.height = maskLayer.height = H
    feathered = rect.x > 2 || rect.y > 2
    if (!feathered) return
    var m = maskLayer.getContext('2d')
    m.fillStyle = '#000'
    m.fillRect(0, 0, W, H)
    m.globalCompositeOperation = 'destination-out'
    function edge(x0, y0, x1, y1) {
      var g = m.createLinearGradient(x0, y0, x1, y1)
      g.addColorStop(0, 'rgba(0,0,0,1)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      m.fillStyle = g
      m.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) || W, Math.abs(y1 - y0) || H)
    }
    if (rect.x > 2) { var fx = W * 0.14; edge(0, 0, fx, 0); edge(W, 0, W - fx, 0) }
    if (rect.y > 2) { var fy = H * 0.06; edge(0, 0, 0, fy); edge(0, H, 0, H - fy) }
    m.globalCompositeOperation = 'source-over'
  }

  function resize() {
    rect.dpr = Math.min(window.devicePixelRatio || 1, 2)
    rect.cw = canvas.clientWidth
    rect.ch = canvas.clientHeight
    canvas.width = Math.round(rect.cw * rect.dpr)
    canvas.height = Math.round(rect.ch * rect.dpr)
    var scale = Math.min(rect.cw / FRAME_W, rect.ch / FRAME_H)
    rect.w = FRAME_W * scale
    rect.h = FRAME_H * scale
    rect.x = (rect.cw - rect.w) / 2
    rect.y = (rect.ch - rect.h) / 2
    // طبقة التسميات تطابق مستطيل الإطار تماماً
    box.style.left = rect.x + 'px'
    box.style.top = rect.y + 'px'
    box.style.width = rect.w + 'px'
    box.style.height = rect.h + 'px'
    renderBackground()
    renderMask()
    drawn = -1
  }

  function progress() {
    var r = section.getBoundingClientRect()
    var total = section.offsetHeight - window.innerHeight
    return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0
  }

  function draw(target) {
    // أقرب إطار محمَّل (الأولوية لما قبله)
    var i = -1
    for (var d = 0; d < FRAME_COUNT && i < 0; d++) {
      if (target - d >= 0 && ready[target - d]) i = target - d
      else if (target + d < FRAME_COUNT && ready[target + d]) i = target + d
    }
    if (i < 0 || i === drawn) return
    var dx = Math.round(rect.x * rect.dpr), dy = Math.round(rect.y * rect.dpr)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(bgLayer, 0, 0)
    if (feathered) {
      // الإطار بحواف تذوب في الخلفية
      var f = frameLayer.getContext('2d')
      f.globalCompositeOperation = 'source-over'
      f.clearRect(0, 0, frameLayer.width, frameLayer.height)
      f.drawImage(images[i], 0, 0, frameLayer.width, frameLayer.height)
      f.globalCompositeOperation = 'destination-in'
      f.drawImage(maskLayer, 0, 0)
      ctx.drawImage(frameLayer, dx, dy)
    } else {
      ctx.drawImage(images[i], dx, dy, frameLayer.width, frameLayer.height)
    }
    drawn = i
  }

  function tick() {
    raf = 0
    var p = progress()
    section.style.setProperty('--p', p.toFixed(4))
    applyFades(p)
    wanted = Math.round(Math.min(1, p / FRAMES_END) * (FRAME_COUNT - 1))
    draw(wanted)
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(tick) }

  // ترتيب التحميل: الأول، ثم كل ثامن إطار، ثم الباقي — حتى يجد السكرول السريع
  // إطاراً قريباً مرسوماً قبل اكتمال التحميل.
  function loadOrder() {
    var seen = {}, out = []
    ;[FRAME_COUNT, 8, 4, 2, 1].forEach(function (step) {
      for (var i = 0; i < FRAME_COUNT; i += step) if (!seen[i]) { seen[i] = true; out.push(i) }
    })
    return out
  }

  function markReady(i) {
    if (ready[i]) return
    ready[i] = true
    readyCount++
    loader.style.transform = 'scaleX(' + (readyCount / FRAME_COUNT) + ')'
    if (readyCount === FRAME_COUNT) loader.style.opacity = '0'
    if (drawn < 0 || Math.abs(i - wanted) < Math.abs(drawn - wanted)) { drawn = -1; schedule() }
  }

  for (var n = 0; n < FRAME_COUNT; n++) { images.push(new Image()); ready.push(false) }
  loadOrder().forEach(function (i) {
    var img = images[i]
    img.decoding = 'async'
    img.onload = function () {
      if (img.decode) img.decode().then(function () { markReady(i) }, function () { markReady(i) })
      else markReady(i)
    }
    img.src = frameSrc(i)
  })

  plate.onload = function () { plateReady = true; renderBackground(); drawn = -1; schedule() }
  plate.src = 'assets/wall.png'

  resize()
  tick()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', function () { resize(); schedule() })

  // ── أزرار "اطلب الآن" ──
  var order = document.getElementById('order')
  document.querySelectorAll('[data-go-order]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault()
      order.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })

  // شريط الطلب الثابت على الهاتف يختفي حين يظهر النموذج
  var bar = document.getElementById('mobileBar')
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-hidden', entries[0].isIntersecting)
    }, { rootMargin: '0px 0px -20% 0px' }).observe(order)
  }

  // ── النموذج (الطلب غير مفعّل حالياً) ──
  var select = document.getElementById('wilaya')
  ;(window.WILAYAS || []).forEach(function (w) {
    var opt = document.createElement('option')
    opt.value = w
    opt.textContent = w
    select.appendChild(opt)
  })

  var addressField = document.getElementById('addressField')
  document.querySelectorAll('[data-delivery]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-delivery]').forEach(function (b) { b.classList.toggle('is-active', b === btn) })
      addressField.style.display = btn.getAttribute('data-delivery') === 'home' ? '' : 'none'
    })
  })

  var qty = 1, MAX_QTY = 10
  var qtyOut = document.getElementById('qty')
  var qtyBtns = document.querySelectorAll('[data-qty]')
  function renderQty() {
    qtyOut.textContent = qty
    qtyBtns[0].disabled = qty <= 1
    qtyBtns[1].disabled = qty >= MAX_QTY
  }
  qtyBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      qty = Math.max(1, Math.min(MAX_QTY, qty + Number(b.getAttribute('data-qty'))))
      renderQty()
    })
  })
  renderQty()

  var phone = document.querySelector('input[name="phone"]')
  phone.addEventListener('input', function () { phone.value = phone.value.replace(/\D/g, '') })

  document.getElementById('orderForm').addEventListener('submit', function (e) { e.preventDefault() })
})()
