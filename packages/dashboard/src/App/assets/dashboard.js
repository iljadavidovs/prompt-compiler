// Legacy routes converge on the maintained, inert-text workspace.
const page = document.body.dataset.page || 'playground';
location.replace(`/dashboard/playground/#${['history', 'tools', 'settings'].includes(page) ? page : 'playground'}`);
