(function () {
  function escapeForSelector(name) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(name);
    }
    return String(name).replace(
      /([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,
      '\\$1',
    );
  }

  var alerts = document.querySelectorAll(
    '.alert-validation[data-error-fields]',
  );
  if (!alerts.length) return;

  alerts.forEach(function (alert) {
    var raw = alert.getAttribute('data-error-fields') || '[]';
    var fields = [];

    try {
      fields = JSON.parse(raw);
    } catch (_err) {
      fields = [];
    }

    var uniqueFields = Array.from(new Set(fields.filter(Boolean)));
    var firstInvalid = null;

    uniqueFields.forEach(function (fieldName) {
      var selector = '[name="' + escapeForSelector(fieldName) + '"]';
      var inputs = document.querySelectorAll(selector);

      inputs.forEach(function (input) {
        input.classList.add('field-error');
        input.setAttribute('aria-invalid', 'true');

        if (!firstInvalid) firstInvalid = input;

        var clearErrorState = function () {
          input.classList.remove('field-error');
          input.removeAttribute('aria-invalid');
        };

        input.addEventListener('input', clearErrorState, { once: true });
        input.addEventListener('change', clearErrorState, { once: true });
      });
    });

    if (firstInvalid) {
      firstInvalid.focus();
    }
  });
})();
