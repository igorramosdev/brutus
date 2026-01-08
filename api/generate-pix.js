const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // 1. Configuração de CORS (Permite que seu site acesse este backend)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0'); // Não fazer cache de pagamento

  // Responde imediatamente a requisições OPTIONS (Pre-flight do navegador)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Verificação de Credenciais (Variáveis de Ambiente)
    const publicKey = process.env.ANUBIS_PUBLIC_KEY;
    const secretKey = process.env.ANUBIS_SECRET_KEY;

    if (!publicKey || !secretKey) {
      console.error("ERRO CRÍTICO: Chaves da API Anubis não configuradas no .env");
      return res.status(500).json({ 
        error: 'Erro de configuração do servidor.', 
        details: 'Credenciais de pagamento ausentes.' 
      });
    }

    // 3. Processamento dos Dados Recebidos
    const { amount, customer, items } = req.body;

    // Converte valor para centavos (R$ 29,90 -> 2990)
    let valueInCents = 0;
    if (typeof amount === 'string') {
      valueInCents = Math.round(parseFloat(amount.replace('R$', '').replace(/\./g, '').replace(',', '.')) * 100);
    } else {
      valueInCents = Math.round(amount * 100);
    }

    if (isNaN(valueInCents) || valueInCents <= 0) {
      return res.status(400).json({ error: 'Valor inválido para pagamento.' });
    }

    // Cria o hash de autenticação Basic
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    // Monta o payload para a AnubisPay
    const apiPayload = {
      amount: valueInCents,
      payment_method: 'pix',
      postback_url: "https://webhook.site/d69ba6ed-3b46-40eb-9e9f-15e66a57161d", // Opcional: Seu Webhook
      customer: {
        name: customer?.name || 'Cliente Visitante',
        email: customer?.email || 'cliente@email.com',
        document: {
          type: 'cpf',
          number: customer?.cpf?.replace(/\D/g, '') || '00000000000'
        }
      },
      items: items || [
        {
          title: 'Pedido Online',
          unit_price: valueInCents,
          quantity: 1,
          tangible: false
        }
      ],
      metadata: {
        provider_name: "Checkout Vercel"
      }
    };

    console.log("Enviando requisição para AnubisPay...");

    // 4. Chamada à API Externa
    const apiResponse = await fetch('https://api2.anubispay.com.br/v1/payment-transaction/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(apiPayload)
    });

    // 5. Tratamento Robusto da Resposta
    const responseText = await apiResponse.text();

    // VERIFICAÇÃO DE ERRO HTML (Causa do "Unexpected token <")
    if (responseText.trim().startsWith('<')) {
      console.error("ERRO: A API Anubis retornou HTML:", responseText);
      return res.status(502).json({ 
        error: 'Erro na operadora de pagamento.', 
        details: 'A API retornou uma página de erro HTML em vez de dados JSON.' 
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("ERRO: Falha ao converter resposta para JSON:", responseText);
      return res.status(500).json({ error: 'Resposta inválida da API de pagamento.' });
    }

    // Verifica se a resposta contém os dados do Pix
    if (apiResponse.ok) {
      // Mapeamento flexível dos campos (caso a API mude nomes)
      const pixCode = data.pix?.qrcode_text || data.qrcode_text || data.pix_code || data.PixCopyPaste;
      const qrImage = data.pix?.qrcode || data.qrcode || data.qrcode_base64 || data.QRCodeBase64;
      const transactionId = data.Id || data.id || data.transaction_id;

      if (!pixCode) {
         console.error("ERRO: Pix gerado mas sem código copia e cola:", data);
         return res.status(500).json({ error: 'Pagamento criado, mas código Pix não retornado.', details: data });
      }

      return res.status(200).json({
        success: true,
        transactionId: transactionId,
        pix_copy_paste: pixCode,
        qr_code_base64: qrImage
      });

    } else {
      // Retorna o erro exato que a Anubis enviou
      console.error("Erro da API Anubis:", data);
      return res.status(apiResponse.status).json({
        error: data.message || 'Falha ao processar pagamento na AnubisPay.',
        details: data
      });
    }

  } catch (error) {
    console.error("Erro interno do servidor:", error);
    return res.status(500).json({ error: 'Erro interno no servidor Vercel: ' + error.message });
  }
};