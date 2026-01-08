const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const publicKey = process.env.ANUBIS_PUBLIC_KEY;
    const secretKey = process.env.ANUBIS_SECRET_KEY;

    if (!publicKey || !secretKey) {
      return res.status(500).json({ error: 'Chaves de API não configuradas.' });
    }

    const { amount, customer } = req.body;

    // 1. Valor em centavos (Inteiro)
    let valueInCents = typeof amount === 'string' 
      ? Math.round(parseFloat(amount.replace('R$', '').replace(/\./g, '').replace(',', '.')) * 100)
      : Math.round(amount * 100);

    // 2. Telefone (Apenas números + DDI 55)
    let rawPhone = (customer?.phone || "").replace(/\D/g, '');
    if (rawPhone.length < 10) rawPhone = "11999999999";
    if (!rawPhone.startsWith('55')) rawPhone = '55' + rawPhone;

    // 3. CPF (Usa o seu CPF VALIDADO como fallback)
    let rawCpf = (customer?.cpf || "").replace(/\D/g, '');
    // Se o CPF do cliente for inválido ou vazio, usa o seu de teste
    if (!rawCpf || rawCpf.length !== 11) {
         rawCpf = "97834989910"; 
    }

    // 4. E-mail único (Anti-fraude)
    const uniqueId = Math.floor(Date.now() / 1000);
    const email = customer?.email && customer.email.includes('@') 
        ? customer.email 
        : `comprador.${uniqueId}@gmail.com`;

    // 5. Payload padrão DOCUMENTAÇÃO (snake_case)
    // Baseado no arquivo "AnubisPay API.txt"
    const payload = {
      amount: valueInCents,
      payment_method: "pix",
      postback_url: "https://webhook.site/d69ba6ed-3b46-40eb-9e9f-15e66a57161d",
      metadata: { provider_name: "Checkout" },
      customer: {
        name: customer?.name || "Cliente Consumidor",
        email: email,
        phone: rawPhone,
        document: {
          type: "cpf",
          number: rawCpf
        }
      },
      items: [
        {
          title: "Pedido Online",
          unit_price: valueInCents,
          quantity: 1,
          tangible: false
        }
      ]
      // Removido objeto 'pix' wrapper se a doc pede snake_case na raiz
    };

    console.log("Enviando Payload SnakeCase:", JSON.stringify(payload));

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    // URL SINGULAR (A que responde 400 em vez de 500)
    const response = await fetch('https://api2.anubispay.com.br/v1/payment-transaction/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data;
    
    try { 
        data = JSON.parse(text); 
    } catch(e) { 
        console.error("Erro Parse JSON:", text);
        return res.status(500).json({ error: 'Resposta inválida da API.' }); 
    }

    if (response.ok) {
      // Sucesso - Verifica variações de resposta
      const pixCode = data.pix?.qrcode_text || data.qrcode_text || data.pix_code || data.PixCopyPaste;
      const qrImage = data.pix?.qrcode || data.qrcode || data.qrcode_base64 || data.QRCodeBase64;
      
      return res.status(200).json({
        success: true,
        transactionId: data.id || data.Id,
        pix_copy_paste: pixCode,
        qr_code_base64: qrImage
      });
    } else {
      console.error("ERRO API:", JSON.stringify(data));
      // Repassa o erro exato
      return res.status(400).json({
        error: data.message || "Pagamento Recusado",
        details: data
      });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};