import nodemailer from 'nodemailer'

// Outgoing mail over plain SMTP, so any free provider works — e.g. Gmail with an
// app password (smtp.gmail.com:465), Brevo or Resend SMTP. Configure via env:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM (defaults to SMTP_USER).

export const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

let transport: nodemailer.Transporter | null = null

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 465)
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return transport
}

export async function sendMail(to: string, subject: string, text: string) {
  if (!mailConfigured()) throw new Error('SMTP is not configured')
  await getTransport().sendMail({
    from: process.env.MAIL_FROM || `RepTrack <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  })
}
