
async function loadMyBids() {
  const container = document.getElementById('myBids');
  container.replaceChildren();
  showMessage('Loading your bids...');

  try {
    const result = await api('/api/bids/mine');
    const bids = result.bids || [];

    if (bids.length === 0) {
      showMessage('You have not placed any bids yet.');
      return;
    }

    showMessage(`${bids.length} bid(s) found.`);

    for (const bid of bids) {
      const auction = bid.auction || {};
      const card = element('article', undefined, 'auction-card');

      card.append(
        element('h2', auction.title || 'Auction no longer available'),
        element('p', `Your bid: ${money(bid.amount)}`),
        element('p', `Auction status: ${auction.status || 'Unknown'}`),
        element('p', `Bid placed: ${bid.bidTime ? new Date(bid.bidTime).toLocaleString() : 'Unknown'}`)
      );

      if (auction.status === 'CLOSED') {
        card.append(
          element('p', `Final price: ${money(auction.finalPrice)}`)
        );
      }

      container.append(card);
    }
  } catch (error) {
    showMessage(error.message, true);
  }
}

document.getElementById('logoutButton').addEventListener('click', logout);
loadMyBids();