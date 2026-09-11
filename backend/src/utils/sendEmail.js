const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html, text }) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        const error = new Error("Email configuration is missing");
        error.code = "EMAIL_CONFIG_MISSING";
        throw error;
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });

    return transporter.sendMail({
        from: { name: "LeadFlow Support", address: process.env.EMAIL_USER },
        to: { address: to },
        subject,
        html,
        text,
    });
};

module.exports = sendEmail;
