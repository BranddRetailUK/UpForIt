document.getElementById("buyTicketBtn").addEventListener("click", async () => {
  try {
    const response = await fetch("http://localhost:3000/api/checkout/create-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    }
  } catch (err) {
    console.error("Checkout error", err);
  }
});
