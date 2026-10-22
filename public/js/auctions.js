
const auctionsContainer = document.getElementById('auctions');
let currentStatus = 'OPEN';

async function loadAuctions(status = currentStatus) {
  currentStatus = status;
  auctionsContainer.replaceChildren();
  showMessage('Loading auctions...');

  try {
    const result = await api(`/api/auctions?status=${status}`);
    const auctions = result.auctions || [];

    if (auctions.length === 0) {
      showMessage(`No ${status.toLowerCase()} auctions found.`);
      return;
    }

    showMessage(`${auctions.length} auction(s) found.`);

    for (const auction of auctions) {
      const card = element('article', undefined, 'auction-card');

      if (auction.image) {
        const image = element('img');
        image.src = `/uploads/${encodeURIComponent(auction.image)}`;
        image.alt = auction.title || 'Auction item';
        image.loading = 'lazy';
        card.append(image);
      }

      card.append(
        element('h2', auction.title || 'Untitled auction'),
        element('p', auction.description || 'No description provided.'),
        element('p', `Minimum price: ${money(auction.minPrice)}`),
        element('p', `Status: ${auction.status}`),
        element('p', `Time limit: ${auction.timeLimitSec} seconds`)
      );

      if (auction.status === 'OPEN') {
        const bidForm = element('form');
        bidForm.noValidate = false;

        const amountLabel = element('label', 'Your bid amount');
        const amountInput = element('input');
        amountInput.type = 'number';
        amountInput.name = 'amount';
        amountInput.min = auction.minPrice;
        amountInput.step = '0.01';
        amountInput.required = true;
        amountLabel.append(amountInput);

        const bidButton = element('button', 'Place Bid');
        bidButton.type = 'submit';

        bidForm.append(amountLabel, bidButton);
        bidForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!bidForm.reportValidity()) return;

          try {
            const amount = Number(amountInput.value);
            await api('/api/bids', {
              method: 'POST',
              body: JSON.stringify({
                auctionId: auction._id,
                amount
              })
            });

            showMessage('Bid placed successfully.');
            await loadAuctions(currentStatus);
          } catch (error) {
            showMessage(error.message, true);
          }
        });

        card.append(bidForm);
      }

      auctionsContainer.append(card);
    }
  } catch (error) {
    showMessage(error.message, true);
  }
}

document.getElementById('openButton')
  .addEventListener('click', () => loadAuctions('OPEN'));

document.getElementById('closedButton')
  .addEventListener('click', () => loadAuctions('CLOSED'));

document.getElementById('logoutButton')
  .addEventListener('click', logout);

loadAuctions('OPEN');