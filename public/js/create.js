
const createAuctionForm = document.getElementById('createAuctionForm');

createAuctionForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!createAuctionForm.reportValidity()) return;

  const minPrice = Number(createAuctionForm.minPrice.value);

  if (!Number.isFinite(minPrice) || minPrice <= 0) {
    showMessage('Minimum price must be greater than zero.', true);
    return;
  }

  const image = createAuctionForm.image.files[0];

  if (image && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.type)) {
    showMessage('Choose a JPG, PNG, WEBP, or GIF image.', true);
    return;
  }

  const formData = new FormData(createAuctionForm);

  try {
    const result = await api('/api/auctions/create', {
      method: 'POST',
      body: formData
    });

    showMessage(result.message || 'Auction created successfully.');
    createAuctionForm.reset();

    setTimeout(() => {
      location.href = '/auctions.html';
    }, 800);
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.getElementById('logoutButton').addEventListener('click', logout);