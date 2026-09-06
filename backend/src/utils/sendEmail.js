const nodemailer = require("nodemailer");

const sendEmail = async ({
    to,
    subject,
    html,
}) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",

        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });

    await transporter.sendMail({
        from: `"LeadFlow Support" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};

module.exports = sendEmail;
