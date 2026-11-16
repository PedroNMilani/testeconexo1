import { sessionUser, sessionKey } from '../auth-client.js';
import * as data from '../data.js';
import { navigate } from '../router.js';
import { mountLocation, locationValue, resetLocation } from '../location-ui.js';
import {
  fillProfileFields,
  setProfileTitles,
  validateProfileForm
} from '../shared-ui.js';

export function initPartnerProfile() {
  const form = document.getElementById('partner-profile-form');
  const name = form.elements.namedItem('profile-institution');
  const feedback = document.getElementById('profile-feedback');
  const titles = [
    '[data-account-name]',
    '#parceiro-perfil-titulo',
    '#parceiro-inicio-titulo'
  ];
  let mapMounted = false,
    mapActor = null;
  function renderMap(reset) {
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
    } else if (reset || mapActor !== sessionKey())
      resetLocation('profile-location', sessionUser);
    mapActor = sessionKey();
  }
  async function render(resetMap = false) {
    const actor = sessionKey();
    try {
      const profile = await data.getProfile('partner');
      if (!profile || actor !== sessionKey()) return;
      fillProfileFields(form, profile);
      setProfileTitles(titles, profile['profile-institution']);
      renderMap(resetMap);
    } catch (error) {
      if (actor === sessionKey()) feedback.textContent = error.message;
    }
  }
  async function save(event) {
    event.preventDefault();
    if (
      !validateProfileForm(
        form,
        'profile-institution',
        'Informe o nome da instituição.'
      )
    )
      return;
    const actor = sessionKey();
    try {
      const values = Object.fromEntries(new FormData(form));
      values._location = locationValue('profile-location');
      const profile = await data.saveProfile('partner', values);
      if (actor !== sessionKey()) return;
      setProfileTitles(titles, profile['profile-institution']);
      feedback.textContent = 'Perfil atualizado.';
    } catch (error) {
      if (actor === sessionKey()) feedback.textContent = error.message;
    }
  }
  async function cancel() {
    await render(true);
    feedback.textContent = '';
    navigate('parceiro-inicio');
  }
  function onSessionChanged() {
    if (sessionUser?.perfil === 'parceiro') {
      render();
      return;
    }
    form.reset();
    feedback.textContent = '';
    mapActor = null;
    resetLocation('profile-location', null);
    setProfileTitles(titles, 'Conta do parceiro');
  }
  form.addEventListener('submit', save);
  form.addEventListener('input', () => name.setCustomValidity(''));
  document.getElementById('cancel-profile').addEventListener('click', cancel);
  document.addEventListener('conexo:session', onSessionChanged);
  return render;
}
