const orders = [];

exports.createOrderAndTickets = async (data) => {
  const order = {
    id: `order_${Date.now()}`,
    stripeSessionId: data.stripeSessionId,
    email: data.email,
    phone: null, // filled later if WhatsApp opt-in
    amount: data.amount,
    tickets: [
      {
        ticketId: `ticket_${Math.random().toString(36).substring(2, 10)}`,
        status: "valid"
      }
    ],
    createdAt: new Date()
  };

  orders.push(order);
  console.log("Order stored:", order);

  return order;
};
