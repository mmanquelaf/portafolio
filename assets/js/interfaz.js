'use strict';

(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('#theme-toggle');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem('portfolio-theme'); } catch {}
  function setTheme(theme) {
    root.dataset.theme = theme;
    const label = theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
  }
  setTheme(['light', 'dark'].includes(preference) ? preference : systemTheme.matches ? 'dark' : 'light');
  themeButton.hidden = false;
  themeButton.addEventListener('click', () => {
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(preference);
    try { localStorage.setItem('portfolio-theme', preference); } catch {}
  });
  systemTheme.addEventListener('change', event => {
    if (!preference) setTheme(event.matches ? 'dark' : 'light');
  });

  const menuButton = document.querySelector('#menu-toggle');
  const nav = document.querySelector('#main-nav');
  const mobile = matchMedia('(max-width: 700px)');
  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    nav.hidden = mobile.matches;
    menuButton.hidden = !mobile.matches;
  }
  closeMenu();
  mobile.addEventListener('change', closeMenu);
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    nav.hidden = !open;
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu(); menuButton.focus();
    }
  });

  const links = [...nav.querySelectorAll('a')];
  const header = document.querySelector('.header');
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  header.append(progress);
  const sections = [...document.querySelectorAll('main section[id]')];
  let scheduled = false;
  function updateNavigation() {
    scheduled = false;
    const total = root.scrollHeight - window.innerHeight;
    const ratio = total > 0 ? Math.min(1, Math.max(0, window.scrollY / total)) : 0;
    progress.style.transform = `scaleX(${ratio})`;
    const marker = header.getBoundingClientRect().bottom + 80;
    let active = sections[0];
    sections.forEach(section => {
      if (section.getBoundingClientRect().top <= marker) active = section;
    });
    if (total > 0 && window.scrollY >= total - 2) active = sections.at(-1);
    links.forEach(link => {
      if (link.hash === `#${active.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function scheduleUpdate() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateNavigation); }
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleUpdate).observe(document.body);
  updateNavigation();

  const message = document.querySelector('#contact-message');
  const count = document.querySelector('#message-count');
  const updateCount = () => { count.textContent = `${message.value.length} / ${message.maxLength} caracteres`; };
  count.hidden = false;
  message.addEventListener('input', updateCount);
  message.form.addEventListener('reset', () => setTimeout(updateCount, 0));
  updateCount();
})();
