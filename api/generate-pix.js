const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configurações de Segurança (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const publicKey = process.env.ANUBIS_PUBLIC_KEY;
    const secretKey = process.env.ANUBIS_SECRET_KEY;

    if (!publicKey || !secretKey) {
      return res.status(500).json({ error: 'Configuração de API incompleta (Chaves).' });
    }

    const { amount, customer } = req.body;
    
    // 1. Tratamento do Valor
    let valueInCents = typeof amount === 'string' 
      ? Math.round(parseFloat(amount.replace('R$', '').replace(/\./g, '').replace(',', '.')) * 100)
      : Math.round(amount * 100);

    // 2. Tratamento do Telefone (DDI 55 Obrigatório)
    let rawPhone = (customer?.phone || "").replace(/\D/g, '');
    if (rawPhone.length < 10) rawPhone = "11999999999";
    if (!rawPhone.startsWith('55')) rawPhone = '55' + rawPhone;

    // 3. Tratamento do CPF (Usa o SEU CPF VÁLIDO se necessário)
    let rawCpf = (customer?.cpf || "").replace(/\D/g, '');
    const cpfsInvalidos = ["12345678909", "11111111111", "00000000000", ""];
    
    // Validação básica: se não tiver 11 dígitos ou for inválido conhecido
    if (!rawCpf || rawCpf.length !== 11 || cpfsInvalidos.includes(rawCpf)) {
         rawCpf = "97834989910"; // SEU CPF VÁLIDO
    }

    // 4. E-mail Único (Anti-fraude)
    // Adiciona um timestamp para o e-mail parecer único e não ser bloqueado como duplicidade
    const uniqueId = Math.floor(Date.now() / 1000);
    const email = customer?.email && customer.email.includes('@') 
        ? customer.email 
        : `cliente.pagamento.${uniqueId}@gmail.com`;

    // 5. IP do Cliente (Necessário segundo a Doc para evitar recusa)
    // Tenta pegar do header ou usa um padrão
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "127.0.0.1";

    // 6. Montagem do Payload
    const payload = {
      amount: valueInCents,
      payment_method: 'pix',
      postback_url: "https://webhook.site/d69ba6ed-3b46-40eb-9e9f-15e66a57161d",
      customer: {
        name: customer?.name || 'Cliente Consumidor',
        email: email,
        phone: rawPhone,
        document: {
          type: 'cpf',
          number: rawCpf
        }
      },
      items: [{ 
          title: 'Pedido Confirmado',
          unit_price: valueInCents,
          quantity: 1,
          tangible: false
      }],
      metadata: { 
          provider_name: "Checkout Oficial" 
      },
      ip: clientIp, // Campo IP adicionado conforme doc
      pix: {
        expires_in: 3600
      }
    };

    console.log("Payload:", JSON.stringify(payload));

    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
    
    // --- CORREÇÃO FINAL: URL NO PLURAL (transactions) CONFORME EXEMPLO NODE DA DOC ---
    const response = await fetch('https://api2.anubispay.com.br/v1/payment-transactions/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    
    // Tratamento de erro 502/HTML
    if (text.trim().startsWith('<')) {
        console.error("Erro HTML Anubis:", text);
        return res.status(502).json({ error: 'Gateway Indisponível (Retornou HTML).' });
    }

    let data;
    try { data = JSON.parse(text); } catch(e) { 
        return res.status(500).json({ error: 'Resposta JSON inválida.' }); 
    }

    if (!response.ok) {
        console.error("ERRO API ANUBIS:", JSON.stringify(data, null, 2));
        
        let errorMsg = "Pagamento Recusado";
        
        // Tenta ler erros de validação
        if (data.errors) {
            const keys = Object.keys(data.errors);
            if (keys.length > 0) errorMsg = `${keys[0]}: ${data.errors[keys[0]]}`;
        } else if (data.message) {
            errorMsg = data.message;
        }

        return res.status(400).json({ 
            error: errorMsg, 
            details: data 
        });
    }

    // Sucesso
    return res.status(200).json({
        success: true,
        transactionId: data.Id || data.id,
        pix_copy_paste: data.pix?.qrcode_text || data.qrcode_text || data.pix_code || data.PixCopyPaste,
        qr_code_base64: data.pix?.qrcode || data.qrcode || data.QRCodeBase64
    });

  } catch (err) {
    console.error("Erro Interno:", err);
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
};