import { logout } from './auth-client.js';
import { activeSection, navigate } from './router.js';

export const instance = (id) =>
  document.getElementById(id).content.firstElementChild.cloneNode(true);
export function text(root, selector, value) {
  root.querySelector(selector).textContent = value ?? '';
}
export function tail(node, value) {
  [...node.childNodes]
    .filter((child) => child.nodeType === Node.TEXT_NODE)
    .forEach((child) => child.remove());
  node.append(value ?? '');
}
export function bindAreaHeader({
  sections,
  headerId,
  nav,
  accountButtonId,
  group = (section) => section
}) {
  function renderHeader() {
    document.getElementById(headerId).hidden = !sections.has(activeSection);
    document.querySelectorAll(`${nav} [data-section]`).forEach((link) => {
      if (link.dataset.section === group(activeSection))
        link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    bootstrap.Dropdown.getInstance(
      document.getElementById(accountButtonId)
    )?.hide();
  }
  document.addEventListener('conexo:navigate', renderHeader);
  renderHeader();
}
export function bindLogout(selector, mode) {
  document.querySelector(selector).addEventListener('click', async () => {
    try {
      await logout();
    } catch (error) {
      document.getElementById('login-feedback').textContent = error.message;
      return;
    }
    document.querySelector('#login [name="password"]').value = '';
    navigate('login', { mode });
  });
}
// Operações pequenas usadas pelos dois formulários de perfil.
export function fillProfileFields(form, profile) {
  for (const [key, value] of Object.entries(profile)) {
    const control = form.elements.namedItem(key);
    if (control) control.value = value;
  }
}
export function setProfileTitles(selectors, name) {
  selectors.forEach(
    (selector) => (document.querySelector(selector).textContent = name)
  );
}
export function validateProfileForm(form, fieldName, message) {
  const name = form.elements.namedItem(fieldName);
  name.setCustomValidity(name.value.trim() ? '' : message);
  return form.reportValidity();
}
export function normalizeText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}
