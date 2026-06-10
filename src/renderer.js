'use strict';

const stage = document.getElementById('stage');
const kimiEl = document.getElementById('kimi');
const sprite = document.querySelector('.sprite');

// Si l'orientation des sprites te paraît inversée, mets ceci à false.
const ART_FACES_LEFT = false;

const STATES = ['idle', 'walk', 'drag', 'fall', 'sleep'];
let currentState = 'idle';
let dragging = false;

window.kimi.onScale((s) => {
  document.documentElement.style.setProperty('--kimi-scale', s);
});

window.kimi.onState(({ state, facing }) => {
  if (state !== currentState) {
    STATES.forEach((s) => stage.classList.remove('state-' + s));
    stage.classList.add('state-' + state);

    STATES.forEach((s) => sprite.classList.remove(s));
    sprite.classList.add(state);

    currentState = state;
    dragging = state === 'drag';
  }
  const flip = ART_FACES_LEFT ? facing === 1 : facing === -1;
  stage.classList.toggle('flip', flip);
});

// --- Attraper / lâcher ------------------------------------------------------
kimiEl.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    dragging = true;
    window.kimi.dragStart();
    e.preventDefault();
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0 && dragging) {
    dragging = false;
    window.kimi.dragEnd();
  }
});

// Clic droit -> menu
kimiEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.kimi.openMenu();
});
