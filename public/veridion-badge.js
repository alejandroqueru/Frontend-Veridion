/*
 * Veridion embeddable verification badge — drop-in loader.
 *
 * Usage on a third-party site:
 *
 *   <div data-veridion-badge data-address="GABC...XYZ"></div>
 *   <script src="https://<host>/veridion-badge.js" async></script>
 *
 * Each matching element is replaced with an <iframe> pointing at the isolated
 * /embed/verification-badge page. Using an iframe means the badge cannot read
 * the host page and the host cannot read the badge — no data leaks either way.
 */
(function () {
  'use strict';

  // Origin this script was served from — the badge is loaded from the same host.
  var script = document.currentScript;
  var origin = script ? new URL(script.src).origin : window.location.origin;

  function mount(el) {
    if (el.getAttribute('data-veridion-mounted') === 'true') return;
    var address = el.getAttribute('data-address');
    if (!address) return;

    var iframe = document.createElement('iframe');
    iframe.src = origin + '/embed/verification-badge?address=' + encodeURIComponent(address);
    iframe.title = 'Veridion verification badge';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.style.border = '0';
    iframe.style.width = '220px';
    iframe.style.height = '32px';
    iframe.style.colorScheme = 'normal';

    el.setAttribute('data-veridion-mounted', 'true');
    el.appendChild(iframe);
  }

  function mountAll() {
    var nodes = document.querySelectorAll('[data-veridion-badge]');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
})();
