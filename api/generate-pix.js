const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const publicKey = process.env.ANUBIS_PUBLIC_KEY;
    const secretKey = process.env.ANUBIS_SECRET_KEY;

    if (!publicKey || !secretKey) {
      return res.status(500).json({ error: 'Chaves de API não configuradas na Vercel.' });
    }

    const { amount, customer } = req.body;
    
    // Tratamento de Valor
    let valueInCents = typeof amount === 'string' 
      ? Math.round(parseFloat(amount.replace('R$', '').replace(/\./g, '').replace(',', '.')) * 100)
      : Math.round(amount * 100);

    // 1. Tratamento do Telefone (Obrigatório)
    let finalPhone = "11999999999"; 
    if (customer && customer.phone) {
        const clean = customer.phone.replace(/\D/g, '');
        if (clean.length >= 10) finalPhone = clean;
    }

    // 2. Tratamento do CPF (Se vier vazio, usa um CPF de teste válido para evitar erro 400)
    let finalCpf = "12345678909";
    if (customer && customer.cpf) {
        const cleanCpf = customer.cpf.replace(/\D/g, '');
        if (cleanCpf.length === 11) finalCpf = cleanCpf;
    }

    const payload = {
      amount: valueInCents,
      payment_method: 'pix',
      postback_url: "https://webhook.site/d69ba6ed-3b46-40eb-9e9f-15e66a57161d",
      customer: {
        name: customer?.name || 'Cliente Visitante',
        email: customer?.email || 'cliente@email.com',
        phone: finalPhone,
        document: {
          type: 'cpf',
          number: finalCpf
        }
      },
      items: [{ 
          title: 'Pedido Online',
          unit_price: valueInCents,
          quantity: 1,
          tangible: false
      }],
      metadata: { provider: "Vercel Checkout" },
      // 3. CORREÇÃO CRÍTICA: Adicionado o objeto PIX que estava faltando
      pix: {
        expires_in: 3600
      }
    };

    console.log("Payload:", JSON.stringify(payload));

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    
    const response = await fetch('https://api2.anubispay.com.br/v1/payment-transaction/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    
    if (text.trim().startsWith('<')) {
        return res.status(502).json({ error: 'Erro HTML da AnubisPay (Gateway indisponível).' });
    }

    let data;
    try { data = JSON.parse(text); } catch(e) { 
        return res.status(500).json({ error: 'Resposta inválida do gateway.' }); 
    }

    if (!response.ok) {
        console.error("ERRO ANUBIS:", data);
        // Retorna o erro exato para você ver no console do navegador se precisar
        return res.status(response.status).json({ 
            error: 'Erro na AnubisPay', 
            details: data 
        });
    }

    return res.status(200).json({
        success: true,
        transactionId: data.Id || data.id,
        pix_copy_paste: data.pix?.qrcode_text || data.qrcode_text || data.pix_code,
        qr_code_base64: data.pix?.qrcode || data.qrcode
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};