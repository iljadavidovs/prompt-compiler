/**
 * Generates a client-side script that attaches a POST helper to window.essenceAPI
 * @param {string} name     - Key under window.essenceAPI to assign the helper
 * @param {string} group    - Base URL or group path for the API
 * @param {string} endpoint - Endpoint path appended to group to form full URL
 * @param {string} token    - Bearer token for authorization header
 * @returns {string}        - HTML <script> tag injecting the POST helper
 */
export function generateClientPost(name, group, endpoint, token) {
    return `<script>
    window.essenceAPI = window.essenceAPI || {};
    window.essenceAPI["${name}"] = async function({ body, headers = {} }) {
      const url = "${group}${endpoint}";
      return fetch(url, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${token}',
          ...headers
        },
        body: JSON.stringify(body)
      }).then(r => r.json());
    };
  </script>`;
}
