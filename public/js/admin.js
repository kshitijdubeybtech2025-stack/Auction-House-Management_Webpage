
async function loadAdminStats() {
  showMessage('Loading dashboard...');

  try {
    const result = await api('/api/admin/stats');
    const stats = result.stats || result;

    document.getElementById('userCount').textContent =
      stats.users ?? 0;

    document.getElementById('auctionCount').textContent =
      stats.auctions ?? 0;

    document.getElementById('openAuctionCount').textContent =
      stats.openAuctions ?? 0;

    document.getElementById('bidCount').textContent =
      stats.bids ?? 0;

    showMessage('Dashboard updated.');
  } catch (error) {
    showMessage(error.message, true);

    if (error.message.toLowerCase().includes('log in') ||
        error.message.toLowerCase().includes('permission')) {
      setTimeout(() => {
        location.href = '/login.html';
      }, 1200);
    }
  }
}

document.getElementById('refreshButton')
  .addEventListener('click', loadAdminStats);

document.getElementById('logoutButton')
  .addEventListener('click', logout);

loadAdminStats();