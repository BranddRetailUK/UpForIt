exports.sendWhatsAppTicket = async (order) => {
  // This is where WhatsApp Cloud API will go later
  // For now, we just log

  console.log("WhatsApp ticket delivery queued:", {
    orderId: order.id,
    email: order.email
  });
};
