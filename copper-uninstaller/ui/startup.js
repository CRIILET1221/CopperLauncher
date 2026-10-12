document.addEventListener('DOMContentLoaded', function () {
  var splash = document.getElementById('copper-startup');
  if (!splash) return;
  var image = splash.querySelector('img'), finished = false;
  async function finish() {
    if (finished) return;
    finished = true;
    // Hidden WebViews may pause animation frames; do not wait for them forever.
    await new Promise(function (resolve) {
      var timer = setTimeout(resolve, 180);
      requestAnimationFrame(function () { requestAnimationFrame(function () { clearTimeout(timer); resolve(); }); });
    });
    try {
      if (window.__TAURI__) await window.__TAURI__.core.invoke('startup_ready');
      // Keep the block visible briefly after the native window has appeared.
      setTimeout(function () {
        splash.classList.add('gone');
        setTimeout(function () { splash.remove(); }, 360);
      }, 520);
    } catch (error) { console.error('Copper startup window could not be shown', error); }
  }
  if (image.complete) void finish();
  else { image.addEventListener('load', finish, {once:true}); image.addEventListener('error', finish, {once:true}); }
  setTimeout(finish, 1500);
});
