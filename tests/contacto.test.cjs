// Pruebas aisladas: ninguna petición llega a Formspree.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../assets/js/contacto.js'), 'utf8');

function setup(fetchMock) {
  function element(value = '') {
    return {
      value, validity: { valid: true }, dataset: {}, textContent: '', attrs: {}, handlers: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k]; },
      removeAttribute(k) { delete this.attrs[k]; },
      addEventListener(k, v) { this.handlers[k] = v; },
      focus() { this.focused = true; },
    };
  }
  const fields = { name: element('Visitante'), email: element('visitante@example.com'), subject: element('Consulta'), message: element('Quiero conocer tu proyecto.') };
  const button = element();
  const status = element();
  const form = element();
  form.action = 'https://formspree.io/f/maeoopdj';
  form.elements = fields;
  form.querySelector = () => button;
  form.querySelectorAll = () => Object.values(fields);
  form.reset = () => Object.values(fields).forEach(f => { f.value = ''; });
  const document = { querySelector: selector => selector === '#contact-form' ? form : selector === '#contact-status' ? status : element() };
  class FakeFormData extends Map {
    constructor() { super(Object.entries(fields).map(([key, f]) => [key, f.value])); }
  }
  vm.runInNewContext(source, { document, fetch: fetchMock, FormData: FakeFormData, AbortController, setTimeout, clearTimeout });
  const submit = () => form.handlers.submit({ preventDefault() {} });
  return { form, fields, button, status, submit };
}

test('rechaza campos vacíos o con solo espacios sin enviar', async () => {
  let requests = 0;
  const state = setup(async () => { requests++; });
  state.fields.name.value = '  ';
  state.fields.message.value = '           ';
  await state.submit();
  assert.equal(requests, 0);
  assert.equal(state.fields.name.attrs['aria-invalid'], 'true');
  assert.equal(state.fields.name.focused, true);
});

test('rechaza un correo con validez incorrecta', async () => {
  const state = setup(async () => assert.fail('no debe enviar'));
  state.fields.email.validity.valid = false;
  await state.submit();
  assert.equal(state.fields.email.focused, true);
});

test('envía al endpoint indicado, recorta espacios y limpia solo tras éxito', async () => {
  const state = setup(async (url, options) => {
    assert.equal(url, 'https://formspree.io/f/maeoopdj');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.body.get('name'), 'Visitante');
    return { ok: true };
  });
  state.fields.name.value = ' Visitante ';
  await state.submit();
  assert.equal(state.status.dataset.state, 'success');
  assert.equal(state.fields.message.value, '');
  assert.equal(state.button.disabled, false);
  assert.equal(state.form.attrs['aria-busy'], undefined);
});

test('preserva datos y permite reintentar ante errores HTTP y de red', async () => {
  for (const fetchMock of [async () => ({ ok: false, status: 422 }), async () => { throw new Error('Offline'); }]) {
    const state = setup(fetchMock);
    await state.submit();
    assert.equal(state.status.dataset.state, 'error');
    assert.equal(state.fields.message.value, 'Quiero conocer tu proyecto.');
    assert.equal(state.button.disabled, false);
    assert.equal(state.fields.message.readOnly, false);
  }
});

test('impide envíos duplicados mientras espera y bloquea ediciones', async () => {
  let resolve;
  let requests = 0;
  const state = setup(() => { requests++; return new Promise(r => { resolve = r; }); });
  const pending = state.submit();
  assert.equal(state.button.disabled, true);
  assert.equal(state.fields.message.readOnly, true);
  await state.submit();
  assert.equal(requests, 1);
  resolve({ ok: true });
  await pending;
  assert.equal(state.button.disabled, false);
});

test('distingue límite del servicio y confirmación incierta', async () => {
  const limited = setup(async () => ({ ok: false, status: 429 }));
  await limited.submit();
  assert.match(limited.status.textContent, /más mensajes/);
  const timedOut = setup(async () => { throw Object.assign(new Error('timeout'), { name: 'AbortError' }); });
  await timedOut.submit();
  assert.match(timedOut.status.textContent, /No podemos asegurar/);
  assert.notEqual(timedOut.fields.message.value, '');
});


