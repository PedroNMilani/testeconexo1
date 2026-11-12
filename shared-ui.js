import {
  backendEnabled,
  sessionUser,
  logout,
  renderBackendNotice,
  sessionKey
} from './auth-client.js';
import { mountLocation, locationValue, resetLocation } from './location-ui.js';
import * as data from './data.js';
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
    if (backendEnabled) {
      try {
        await logout();
        renderBackendNotice();
      } catch (error) {
        document.getElementById('login-feedback').textContent = error.message;
        return;
      }
    }
    document.querySelector('#login [name="password"]').value = '';
    navigate('login', { mode });
  });
}
export function bindProfile({
  area,
  formId,
  nameField,
  emailField,
  titles,
  feedbackId,
  cancelId,
  home,
  loginEvent,
  nameError,
  success
}) {
  const form = document.getElementById(formId);
  const name = form.elements.namedItem(nameField);
  const feedback = document.getElementById(feedbackId);
  function renderTitles(profile) {
    titles.forEach((selector, index) => {
      document.querySelector(selector).textContent =
        profile.displayNames[index];
    });
  }
  let mapMounted = false,
    mapActor = null;
  async function renderProfile() {
    try {
      const actor = sessionKey();
      const profile = await data.getProfile(area);
      if (backendEnabled && actor !== sessionKey()) return;
      for (const [key, value] of Object.entries(profile)) {
        const control = form.elements.namedItem(key);
        if (control) control.value = value;
      }
      renderTitles(profile);
      if (backendEnabled && area === 'aacd')
        form.elements.namedItem('unit').disabled = true;
      if (
        backendEnabled &&
        area === 'partner' &&
        sessionUser?.perfil === 'parceiro'
      ) {
        if (!mapMounted) {
          mountLocation(
            'profile-location',
            {
              street: '#profile-street',
              city: '#profile-city',
              state: '#profile-state',
              number: '#profile-number'
            },
            sessionUser
          );
          mapMounted = true;
        } else if (mapActor !== sessionKey())
          resetLocation('profile-location', sessionUser);
        mapActor = sessionKey();
      }
    } catch (error) {
      feedback.textContent = error.message;
    }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!name.value.trim()) {
      name.setCustomValidity(nameError);
      name.reportValidity();
      return;
    }
    const values = Object.fromEntries(new FormData(form));
    if (backendEnabled && area === 'aacd') values.unit = sessionUser.unidade;
    try {
      const profile = await data.saveProfile(area, {
        ...values,
        displayNames: titles.map(() => name.value),
        _location: locationValue('profile-location')
      });
      renderTitles(profile);
      feedback.textContent = success;
    } catch (error) {
      feedback.textContent = error.message;
    }
  });
  form.addEventListener('input', () => name.setCustomValidity(''));
  document.getElementById(cancelId).addEventListener('click', async () => {
    await renderProfile();
    feedback.textContent = '';
    navigate(home);
  });
  document.addEventListener(loginEvent, async (event) => {
    const actor = sessionKey();
    const profile = await data.getProfile(area);
    if (backendEnabled && actor !== sessionKey()) return;
    if (!profile[emailField]) {
      await data.saveProfile(area, {
        ...profile,
        [emailField]: event.detail.email
      });
      form.elements.namedItem(emailField).value = event.detail.email;
    }
  });
  document.addEventListener('conexo:session', () => {
    if (
      (area === 'aacd' && sessionUser?.perfil === 'aacd') ||
      (area === 'partner' && sessionUser?.perfil === 'parceiro')
    )
      renderProfile();
    else if (backendEnabled) {
      form.reset();
      mapActor = null;
      if (area === 'partner') resetLocation('profile-location', null);
      titles.forEach((selector) => {
        document.querySelector(selector).textContent =
          area === 'aacd' ? 'Conta AACD' : 'Conta do parceiro';
      });
    }
  });
  return renderProfile;
}
