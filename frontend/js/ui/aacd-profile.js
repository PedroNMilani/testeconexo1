import { sessionUser, sessionKey } from '../auth-client.js';
import * as data from '../data.js';
import { navigate } from '../router.js';
import {
  fillProfileFields,
  setProfileTitles,
  validateProfileForm
} from '../shared-ui.js';

export function initAacdProfile() {
  const form = document.getElementById('aacd-profile-form');
  const name = form.elements.namedItem('aacd-profile-name');
  const feedback = document.getElementById('aacd-profile-feedback');
  const titles = ['[data-aacd-account]', '#aacd-perfil-titulo'];
  async function render() {
    const actor = sessionKey();
    try {
      const profile = await data.getProfile('aacd');
      if (!profile || actor !== sessionKey()) return;
      fillProfileFields(form, profile);
      form.elements.namedItem('unit').disabled = true;
      setProfileTitles(titles, profile['aacd-profile-name']);
    } catch (error) {
      if (actor === sessionKey()) feedback.textContent = error.message;
    }
  }
  async function save(event) {
    event.preventDefault();
    if (
      !validateProfileForm(
        form,
        'aacd-profile-name',
        'Informe o nome do responsável.'
      )
    )
      return;
    const actor = sessionKey();
    try {
      const values = Object.fromEntries(new FormData(form));
      values.unit = sessionUser.unidade; // O campo é desabilitado e não entra no FormData.
      const profile = await data.saveProfile('aacd', values);
      if (actor !== sessionKey()) return;
      setProfileTitles(titles, profile['aacd-profile-name']);
      feedback.textContent = 'Perfil AACD atualizado.';
    } catch (error) {
      if (actor === sessionKey()) feedback.textContent = error.message;
    }
  }
  async function cancel() {
    await render();
    feedback.textContent = '';
    navigate('aacd-inicio');
  }
  function onSessionChanged() {
    if (sessionUser?.perfil === 'aacd') {
      render();
      return;
    }
    form.reset();
    feedback.textContent = '';
    setProfileTitles(titles, 'Conta AACD');
  }
  form.addEventListener('submit', save);
  form.addEventListener('input', () => name.setCustomValidity(''));
  document
    .getElementById('aacd-profile-cancel')
    .addEventListener('click', cancel);
  document.addEventListener('conexo:session', onSessionChanged);
  return render;
}
