document.documentElement.dataset.ready = 'true';

for (const link of document.querySelectorAll('a[href^="#"]')) {
    link.addEventListener('click', (event) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, '', link.getAttribute('href'));
    });
}
