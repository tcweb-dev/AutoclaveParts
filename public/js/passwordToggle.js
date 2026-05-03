(function () {
  function wireToggle(btn, input, iconShow, iconHide) {
    if (!btn || !input) return;
    var toggleText = btn.querySelector('[data-toggle-text]');

    btn.addEventListener('click', function () {
      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      if (iconShow) iconShow.style.display = isPassword ? 'none' : '';
      if (iconHide) iconHide.style.display = isPassword ? '' : 'none';
      if (toggleText) toggleText.textContent = isPassword ? 'Hide' : 'Show';
      btn.setAttribute(
        'aria-label',
        isPassword ? 'Hide password' : 'Show password',
      );
    });
  }

  var dataButtons = document.querySelectorAll('[data-toggle-password]');
  dataButtons.forEach(function (btn) {
    var inputId = btn.getAttribute('data-toggle-password');
    var input = inputId ? document.getElementById(inputId) : null;
    var iconShow = btn.querySelector('[data-icon-show]');
    var iconHide = btn.querySelector('[data-icon-hide]');
    wireToggle(btn, input, iconShow, iconHide);
  });

  // Legacy fallback used by older markup.
  var legacyInput = document.getElementById('password');
  var legacyBtn = document.getElementById('pwToggle');
  if (legacyBtn && !legacyBtn.hasAttribute('data-toggle-password')) {
    var legacyIconShow = document.getElementById('pwIconShow');
    var legacyIconHide = document.getElementById('pwIconHide');
    wireToggle(legacyBtn, legacyInput, legacyIconShow, legacyIconHide);
  }
})();
