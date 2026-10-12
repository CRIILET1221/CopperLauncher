document.addEventListener('DOMContentLoaded', function () {
  var splash = document.getElementById('copper-startup');
  if (!splash) return;
  var image = splash.querySelector('img'), started = performance.now(), finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    setTimeout(function () {
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        splash.classList.add('gone');
        setTimeout(function () { splash.remove(); }, 360);
      }); });
    }, Math.max(0, 520 - (performance.now() - started)));
  }
  if (image.complete) finish();
  else { image.addEventListener('load', finish, {once:true}); image.addEventListener('error', finish, {once:true}); }
  setTimeout(finish, 3000);
});
