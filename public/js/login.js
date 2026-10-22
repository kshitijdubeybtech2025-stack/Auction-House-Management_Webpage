
document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const username = form.username.value.trim();
  const password = form.password.value;

  try {
    const result = await api('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    showMessage(`Welcome, ${result.user.username}!`);
    location.href = result.user.role === 'ADMIN'
      ? '/admin.html'
      : '/auctions.html';
  } catch (error) {
    showMessage(error.message, true);
  }
});