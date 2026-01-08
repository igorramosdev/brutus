const crypto = require('crypto');

// Cache de webhooks já processados (evitar duplicação)
const processedWebhooks = new Set();

module.exports = async (req, res) => {
    try {
        // Valida método HTTP
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido' });
        }

        // Verifica assinatura do webhook (opcional mas recomendado)
        const webhookSecret = process.env.ANUBIS_WEBHOOK_SECRET;
        const signature = req.headers['x-anubis-signature'] || 
                         req.headers['x-signature'] || 
                         req.headers['signature'];

        if (webhookSecret && signature) {
            const hmac = crypto.createHmac('sha256', webhookSecret);
            const digest = hmac.update(JSON.stringify(req.body)).digest('hex');
            
            if (signature !== digest) {
                console.error('Assinatura de webhook inválida');
                return res.status(401).json({ error: 'Assinatura inválida' });
            }
        }

        const event = req.body;
        
        // Evita processamento duplicado
        const eventId = event.Id || event.id;
        if (processedWebhooks.has(eventId)) {
            console.log(`Webhook ${eventId} já processado, ignorando...`);
            return res.status(200).json({ received: true });
        }
        
        // Limita cache para evitar memory leak
        if (processedWebhooks.size > 1000) {
            const firstKey = processedWebhooks.values().next().value;
            processedWebhooks.delete(firstKey);
        }
        processedWebhooks.add(eventId);

        // Extrai dados principais
        const transactionId = eventId;
        const status = event.Status || event.status;
        const amount = event.Amount || event.amount; // Em centavos
        const paidAt = event.PaidAt || event.paid_at;
        const externalId = event.ExternalId || event.external_id;
        const metadata = event.metadata || {};

        console.log(`📢 Webhook recebido:`, {
            transactionId,
            status,
            amount: amount ? `R$ ${(amount / 100).toFixed(2)}` : 'N/A',
            paidAt,
            orderId: metadata.order_id
        });

        // Aqui você deve integrar com seu banco de dados
        // Exemplo de ações com base no status:
        switch (status) {
            case 'PAID':
                // 1. Atualizar pedido como PAGO no banco
                // 2. Enviar e-mail de confirmação
                // 3. Notificar cozinha/garçom
                console.log(`✅ Pedido ${metadata.order_id} PAGO!`);
                break;
                
            case 'EXPIRED':
                // 1. Atualizar pedido como EXPIRADO
                // 2. Liberar mesa/recursos
                console.log(`⏰ Pedido ${metadata.order_id} EXPIRADO`);
                break;
                
            case 'REFUNDED':
                // 1. Registrar estorno no sistema
                console.log(`↩️ Pedido ${metadata.order_id} ESTORNADO`);
                break;
                
            case 'REFUSED':
                // 1. Notificar cliente sobre pagamento recusado
                console.log(`❌ Pedido ${metadata.order_id} RECUSADO`);
                break;
                
            default:
                console.log(`ℹ️ Pedido ${metadata.order_id} atualizado: ${status}`);
        }

        // Responde rápido para a AnubisPay
        res.status(200).json({ 
            received: true, 
            processed: true 
        });

    } catch (error) {
        console.error('Erro ao processar webhook:', error);
        res.status(500).json({ 
            error: 'Erro interno ao processar webhook' 
        });
    }
};