import * as data from './data.js';
import { activeSection, navigate } from './router.js';

export const instance = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
export function text(root, selector, value) { root.querySelector(selector).textContent = value ?? ''; }
export function tail(node, value) {
  [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE).forEach(child => child.remove());
  node.append(value ?? '');
}
export function bindAreaHeader({ sections, headerId, nav, accountButtonId, group = section => section }) {
  function renderHeader() {
    document.getElementById(headerId).hidden = !sections.has(activeSection);
    document.querySelectorAll(`${nav} [data-section]`).forEach(link => {
      if (link.dataset.section === group(activeSection)) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    bootstrap.Dropdown.getInstance(document.getElementById(accountButtonId))?.hide();
  }
  document.addEventListener('conexo:navigate', renderHeader);
  renderHeader();
}
export function bindLogout(selector, mode) {
  document.querySelector(selector).addEventListener('click', () => {
    document.querySelector('#login [name="password"]').value = '';
    navigate('login', { mode });
  });
}
export function bindProfile({ area, formId, nameField, emailField, titles, feedbackId, cancelId, home, loginEvent, nameError, success }) {
  const form = document.getElementById(formId);
  const name = form.elements.namedItem(nameField);
  const feedback = document.getElementById(feedbackId);
  function renderTitles(profile) {
    titles.forEach((selector, index) => { document.querySelector(selector).textContent = profile.displayNames[index]; });
  }
  async function renderProfile() {
    const profile = await data.getProfile(area);
    for (const [key, value] of Object.entries(profile)) {
      const control = form.elements.namedItem(key);
      if (control) control.value = value;
    }
    renderTitles(profile);
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!name.value.trim()) { name.setCustomValidity(nameError); name.reportValidity(); return; }
    const profile = await data.saveProfile(area, {
      ...Object.fromEntries(new FormData(form)), displayNames: titles.map(() => name.value)
    });
    renderTitles(profile);
    feedback.textContent = success;
  });
  form.addEventListener('input', () => name.setCustomValidity(''));
  document.getElementById(cancelId).addEventListener('click', async () => {
    await renderProfile(); feedback.textContent = ''; navigate(home);
  });
  document.addEventListener(loginEvent, async event => {
    const profile = await data.getProfile(area);
    if (!profile[emailField]) {
      await data.saveProfile(area, { ...profile, [emailField]: event.detail.email });
      form.elements.namedItem(emailField).value = event.detail.email;
    }
  });
  return renderProfile;
}
