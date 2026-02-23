import { createTransport, type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = createTransport({
      host: process.env.SMTP_HOST || 'smtp.worksmobile.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendTwoFaCode(email: string, code: string): Promise<void> {
  const mail = getTransporter();
  await mail.sendMail({
    from: process.env.SMTP_FROM || 'noreply@dioramarketing.co.kr',
    to: email,
    subject: '[DioraServer] 인증 코드',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">DioraServerConnecter 인증 코드</h2>
        <p>외부 네트워크에서 로그인을 시도했습니다. 아래 인증 코드를 입력해주세요.</p>
        <div style="background: #f0f0f0; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">이 코드는 5분 후 만료됩니다.</p>
        <p style="color: #999; font-size: 12px;">본인이 시도하지 않았다면 이 이메일을 무시하고 관리자에게 문의하세요.</p>
      </div>
    `,
  });
}

export async function sendDeviceApprovalNotice(
  email: string,
  deviceName: string,
  approved: boolean,
): Promise<void> {
  const mail = getTransporter();
  const status = approved ? '승인' : '거부';
  await mail.sendMail({
    from: process.env.SMTP_FROM || 'noreply@dioramarketing.co.kr',
    to: email,
    subject: `[DioraServer] 기기 ${status} 알림`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">기기 ${status} 알림</h2>
        <p>요청하신 기기 <strong>${deviceName}</strong>이(가) ${status}되었습니다.</p>
        ${approved ? '<p>이제 해당 기기로 서버에 접속할 수 있습니다.</p>' : '<p>관리자에게 문의하세요.</p>'}
      </div>
    `,
  });
}

export async function sendAdminAlert(
  adminEmail: string,
  subject: string,
  message: string,
): Promise<void> {
  const mail = getTransporter();
  await mail.sendMail({
    from: process.env.SMTP_FROM || 'noreply@dioramarketing.co.kr',
    to: adminEmail,
    subject: `[DioraServer Admin] ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">관리자 알림</h2>
        <p>${message}</p>
        <p style="color: #999; font-size: 12px;">DioraServerConnecter 관리 시스템</p>
      </div>
    `,
  });
}
