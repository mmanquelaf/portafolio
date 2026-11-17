'use strict';

// Mejora progresiva: sin JavaScript, el formulario conserva su envío HTML nativo.
const contactForm = document.querySelector('#contact-form');

if (contactForm && typeof fetch === 'function') {
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const statusMessage = document.querySelector('#contact-status');
  const fields = [
    { input: contactForm.elements.name, error: document.querySelector('#name-error'), min: 2, message: 'Escribe tu nombre (al menos 2 caracteres).' },
    { input: contactForm.elements.email, error: document.querySelector('#email-error'), min: 1, message: 'Escribe un correo electrónico válido.' },
    { input: contactForm.elements.message, error: document.querySelector('#message-error'), min: 10, message: 'Escribe un mensaje de al menos 10 caracteres.' },
  ];
  let sending = false;

  function validateField(field) {
    const invalid = field.input.value.trim().length < field.min || !field.input.validity.valid;
    field.input.setAttribute('aria-invalid', String(invalid));
    field.error.textContent = invalid ? field.message : '';
    return !invalid;
  }

  function announce(message, state) {
    statusMessage.textContent = message;
    statusMessage.dataset.state = state;
  }

  // Solo desactiva la validación nativa después de preparar la alternativa accesible.
  contactForm.noValidate = true;
  fields.forEach((field) => {
    field.input.addEventListener('blur', () => validateField(field));
    field.input.addEventListener('input', () => {
      if (field.input.getAttribute('aria-invalid') === 'true') validateField(field);
      if (!sending) announce('', '');
    });
  });

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;

    const invalidFields = fields.filter((field) => !validateField(field));

    const subject = contactForm.elements.subject;
    if (invalidFields.length || !subject.validity.valid) {
      announce('Revisa los campos indicados antes de enviar.', 'error');
      (invalidFields[0]?.input || subject).focus();
      return;
    }

    const data = new FormData(contactForm);
    ['name', 'email', 'subject', 'message'].forEach((name) => {
      data.set(name, String(data.get(name) || '').trim());
    });

    sending = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando…';
    contactForm.setAttribute('aria-busy', 'true');
    // Evita perder ediciones realizadas mientras se está enviando el mensaje.
    const inputs = Array.from(contactForm.querySelectorAll('input, textarea'));
    inputs.forEach((input) => { input.readOnly = true; });
    announce('Enviando tu mensaje…', 'loading');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) {
          announce('El servicio no puede recibir más mensajes ahora. Inténtalo más tarde.', 'error');
        } else {
          announce('No se pudo enviar el mensaje. Tus datos siguen aquí: revisa los campos e inténtalo más tarde.', 'error');
        }
        return;
      }

      contactForm.reset();
      fields.forEach((field) => {
        field.input.removeAttribute('aria-invalid');
        field.error.textContent = '';
      });
      announce('¡Mensaje enviado! Gracias por escribirme.', 'success');
    } catch (error) {
      announce(error.name === 'AbortError'
        ? 'La confirmación tardó demasiado. No podemos asegurar si llegó el mensaje; compruébalo antes de reenviarlo.'
        : 'No pudimos confirmar el envío. Revisa tu conexión; tus datos siguen aquí. Inténtalo de nuevo cuando recuperes la conexión.', 'error');
    } finally {
      clearTimeout(timeout);
      sending = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Enviar mensaje';
      inputs.forEach((input) => { input.readOnly = false; });
      contactForm.removeAttribute('aria-busy');
      statusMessage.focus();
    }
  });
}



