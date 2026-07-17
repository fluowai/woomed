import nodemailer from 'nodemailer';

// Configuração do transporter baseada nas variáveis de ambiente
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS || '',
  },
});

export async function sendEmail(to: string, subject: string, htmlContent: string) {
  if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_PASS) {
    console.log(`[DEV MODE - E-mail Simulado]\nPara: ${to}\nAssunto: ${subject}\nConteúdo: ${htmlContent}`);
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Consultio Med" <no-reply@consultiomed.com>',
      to,
      subject,
      html: htmlContent,
    });
    console.log(`Mensagem enviada com sucesso: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Erro ao disparar email:', error);
    return false;
  }
}

export async function sendInviteEmail(email: string, role: string, token: string) {
  const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invite?token=${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Bem-vindo à Consultio Med!</h2>
      <p>Você foi convidado para integrar nossa clínica como <strong>${role}</strong>.</p>
      <p>Clique no botão abaixo para criar sua senha e acessar o sistema:</p>
      <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Aceitar Convite</a>
      <p style="margin-top: 30px; font-size: 12px; color: #666;">Se você não esperava por este e-mail, por favor, ignore-o.</p>
    </div>
  `;
  
  return sendEmail(email, 'Convite de Acesso - Consultio Med', html);
}
