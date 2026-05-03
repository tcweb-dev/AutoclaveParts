(function () {
  function isFormControl(element) {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    );
  }

  function getFieldLabel(field, form) {
    if (field.id) {
      var linkedLabel = form.querySelector('label[for="' + field.id + '"]');
      if (linkedLabel) {
        return linkedLabel.textContent.replace(/\*/g, '').trim();
      }
    }

    var wrapper = field.closest('.form-group');
    if (wrapper) {
      var wrapperLabel = wrapper.querySelector('label');
      if (wrapperLabel) {
        return wrapperLabel.textContent.replace(/\*/g, '').trim();
      }
    }

    return field.name || 'This field';
  }

  function applyCustomRules(field, form) {
    if (!(field instanceof HTMLInputElement)) return;

    if (field.type === 'url') {
      var rawUrl = field.value.trim();
      if (rawUrl && !/^https?:\/\//i.test(rawUrl)) {
        var looksLikeDomain = /^[^\s/]+\.[^\s/]+$/.test(rawUrl);
        if (looksLikeDomain) {
          field.value = 'https://' + rawUrl;
        }
      }
    }

    var matchSelector = field.getAttribute('data-match');
    if (!matchSelector) {
      field.setCustomValidity('');
      return;
    }

    var other = form.querySelector(matchSelector);
    if (!other || !(other instanceof HTMLInputElement)) {
      field.setCustomValidity('');
      return;
    }

    if (field.value !== other.value) {
      field.setCustomValidity('Passwords do not match');
      return;
    }

    field.setCustomValidity('');
  }

  function markFieldError(field, isError) {
    if (isError) {
      field.classList.add('field-error');
      field.setAttribute('aria-invalid', 'true');
      return;
    }

    field.classList.remove('field-error');
    field.removeAttribute('aria-invalid');
  }

  function clearClientAlert(form) {
    var existing = form.parentElement
      ? form.parentElement.querySelector('.client-validation-alert')
      : null;
    if (existing) existing.remove();
  }

  function buildValidationAlert(form, messages) {
    var alert = document.createElement('div');
    alert.className =
      'alert alert-error alert-validation client-validation-alert';
    alert.setAttribute('role', 'alert');

    var intro = document.createElement('p');
    intro.className = 'alert-validation-intro';
    intro.textContent =
      'Please review the highlighted fields and complete them before submitting again.';
    alert.appendChild(intro);

    var list = document.createElement('ul');
    messages.forEach(function (msg) {
      var li = document.createElement('li');
      li.textContent = msg;
      list.appendChild(li);
    });
    alert.appendChild(list);

    if (form.parentElement) {
      form.parentElement.insertBefore(alert, form);
    }
  }

  function collectInvalidControls(form) {
    var invalid = [];
    var seenRadioNames = new Set();

    Array.from(form.elements).forEach(function (element) {
      if (!isFormControl(element)) return;
      if (!element.willValidate || element.disabled) return;

      applyCustomRules(element, form);
      var isInvalid = !element.checkValidity();

      if (element instanceof HTMLInputElement && element.type === 'radio') {
        if (!element.name || seenRadioNames.has(element.name)) {
          markFieldError(element, isInvalid);
          return;
        }
        seenRadioNames.add(element.name);
      }

      markFieldError(element, isInvalid);
      if (isInvalid) invalid.push(element);
    });

    return invalid;
  }

  function buildMessages(form, invalidFields) {
    var unique = new Set();

    invalidFields.forEach(function (field) {
      var label = getFieldLabel(field, form);
      var message = field.validationMessage || 'Please check this field.';
      unique.add(label + ': ' + message);
    });

    return Array.from(unique);
  }

  function wireForm(form) {
    Array.from(form.elements).forEach(function (element) {
      if (!isFormControl(element)) return;

      var validateOne = function () {
        applyCustomRules(element, form);
        markFieldError(element, !element.checkValidity());
      };

      element.addEventListener('input', validateOne);
      element.addEventListener('change', validateOne);
    });

    form.addEventListener('submit', function (event) {
      clearClientAlert(form);

      var invalid = collectInvalidControls(form);
      if (!invalid.length) return;

      event.preventDefault();
      var messages = buildMessages(form, invalid);
      buildValidationAlert(form, messages);
      invalid[0].focus();
    });
  }

  var forms = document.querySelectorAll('form');
  if (!forms.length) return;

  forms.forEach(wireForm);
})();
