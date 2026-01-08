const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { id } = req.query;
  const publicKey = process.env.ANUBIS_PUBLIC_KEY;
  const secretKey = process.env.ANUBIS_SECRET_KEY;

  if (!id || !publicKey || !secretKey) {
    return res.status(400).json({ error: 'Dados insuficientes' });
  }

  const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

  try {
    // Busca a transação pelo ID na AnubisPay
    // Nota: A URL abaixo é o padrão REST para Get By ID. 
    // Se a doc for diferente, ajuste para a URL correta de consulta.
    const response = await fetch(`https://api2.anubispay.com.br/v1/payment-transaction/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    // Verifica se o status é PAID 
    const isPaid = data.Status === 'PAID' || data.status === 'PAID';

    res.status(200).json({
      success: true,
      paid: isPaid,
      status: data.Status
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
};