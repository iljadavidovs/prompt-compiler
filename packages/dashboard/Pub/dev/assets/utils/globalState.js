import State from '../State/Manager.js';

const globalState = new State({
    theme: localStorage.getItem('theme') || 'light',
    loggedIn: false,
    userData: {},
    // Add other global defaults
});

window.globalState = globalState; // Now globally accessible!

window.dispatchEvent(new Event('globalStateReady'));

export default globalState;
