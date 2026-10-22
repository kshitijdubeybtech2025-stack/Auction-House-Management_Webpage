
document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const username = form.username.value.trim();
  const password = form.password.value;
  const confirmPassword = form.confirmPassword.value;
  const role = form.role.value;

  if (password !== confirmPassword) {
    showMessage('Passwords do not match.', true);
    return;
  }

  if (!['BUYER', 'SELLER'].includes(role)) {
    showMessage('Select a valid account type.', true);
    return;
  }

  try {
    const result = await api('/api/users/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });

    showMessage(result.message);
    form.reset();
    setTimeout(() => {
      location.href = '/login.html';
    }, 800);
  } catch (error) {
    showMessage(error.message, true);
  }
});