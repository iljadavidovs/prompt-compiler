/**
 * Injects a client-side authentication helper script into the rendered component.
 */
export function injectAuthScript(component, endpoint) {
    const script = `
    <script>
      window.essenceAuth = {
        login: async function (credentials) {
          const res = await fetch('${endpoint}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
          });

          const data = await res.json();

          if (data.token) {
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            window.dispatchEvent(new CustomEvent('authLoggedIn', { detail: data.user }));
          }

          return data;
        },

        logout: function () {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          window.dispatchEvent(new Event('authLoggedOut'));
        },

        getToken: function () {
          return localStorage.getItem('auth_token');
        },

        getUser: function () {
          try {
            return JSON.parse(localStorage.getItem('auth_user')) || null;
          } catch {
            return null;
          }
        },

        isLoggedIn: function () {
          return !!localStorage.getItem('auth_token');
        }
      };
    </script>
  `;

    component.authScript = script;
}
