
async function loadResults() {
  const container = document.getElementById('results');
  container.replaceChildren();
  showMessage('Loading auction results...');

  try {
    const result = await api('/api/auctions?status=CLOSED');
    const auctions = result.auctions || [];

    if (auctions.length === 0) {
      showMessage('No completed auctions yet.');
      return;
    }

    showMessage(`${auctions.length} completed auction(s).`);

    for (const auction of auctions) {
      const card = element('article', undefined, 'auction-card');

      card.append(
        element('h2', auction.title || 'Untitled auction'),
        element('p', auction.description || 'No description provided.'),
        element('p', `Minimum price: ${money(auction.minPrice)}`),
        element('p', `Final price: ${money(auction.finalPrice)}`),
        element(
          'p',
          auction.winnerId
            ? `Winner ID: ${auction.winnerId}`
            : 'No winner — no bids were placed.'
        ),
        element(
          'p',
          `Closed: ${auction.closedAt ? new Date(auction.closedAt).toLocaleString() : 'Date unavailable'}`
        )
      );

      container.append(card);
    }
  } catch (error) {
    showMessage(error.message, true);
  }
}

document.getElementById('logoutButton').addEventListener('click', logout);
loadResults();