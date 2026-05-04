(function initNewsletter(global) {
  "use strict";

  var core = global.AppCore;
  if (!core) return;

  var qs = core.qs;
  var toast = core.toast;

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function setupNewsletterForm() {
    var form = qs("#newsletter-form");
    var emailInput = qs("#newsletter-email");

    if (!form || !emailInput) return;

    form.addEventListener("submit", function onSubmit(event) {
      event.preventDefault();

      var email = (emailInput.value || "").trim();
      if (!isValidEmail(email)) {
        emailInput.setAttribute("aria-invalid", "true");
        emailInput.focus();
        toast("Email chưa hợp lệ. Vui lòng kiểm tra lại.", "error");
        return;
      }

      emailInput.setAttribute("aria-invalid", "false");
      toast("Đăng ký bản tin thành công.");
      form.reset();
    });
  }

  document.addEventListener("DOMContentLoaded", function onReady() {
    setupNewsletterForm();
  });
})(window);
