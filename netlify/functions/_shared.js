const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

const SERVICE_DEFINITIONS = {
  "Classic Fade": { price: "$30", duration: 30 },
  "Fade + Design": { price: "$35", duration: 30 },
  "Buzz Cut": { price: "$30", duration: 30 },
  "Beard Trim + Lineup": { price: "$35", duration: 30 },
  "Cut + Beard Combo": { price: "$30", duration: 45 },
  "Other Custom Style": { price: "$30", duration: 45 },
};

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const notifyEmail = process.env.NOTIFY_EMAIL;

  if (!apiKey || !fromEmail || !notifyEmail) {
    throw new Error("Resend environment variables are missing.");
  }

  return {
    client: new Resend(apiKey),
    fromEmail,
    notifyEmail,
  };
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(payload),
  };
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch (error) {
    throw new Error("Invalid JSON body.");
  }
}

function validateBooking(payload) {
  const service = SERVICE_DEFINITIONS[payload.service];

  if (!service) {
    throw new Error("Selected service is not valid.");
  }

  if (!payload.date || !payload.time || !payload.endTime) {
    throw new Error("Booking date and time are required.");
  }

  if (!payload.name || !payload.email || !payload.phone) {
    throw new Error("Customer name, email, and phone are required.");
  }

  const duration = Number(payload.duration);

  if (duration !== service.duration) {
    throw new Error("Service duration does not match the selected service.");
  }

  return {
    ...payload,
    price: service.price,
    duration,
  };
}

function timeValueToMinutes(timeValue) {
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlapExists(bookings, payload) {
  const candidateStart = timeValueToMinutes(payload.time);
  const candidateEnd = candidateStart + Number(payload.duration);

  return bookings.some((booking) => {
    const bookingStart = timeValueToMinutes(booking.time);
    const bookingEnd = bookingStart + Number(booking.duration);
    return candidateStart < bookingEnd && candidateEnd > bookingStart;
  });
}

function formatNotificationEmail(booking) {
  return {
    subject: `New S&D Blendz booking for ${booking.date} at ${booking.time}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>New S&amp;D Blendz booking</h2>
        <p><strong>Service:</strong> ${booking.service} (${booking.price})</p>
        <p><strong>Date:</strong> ${booking.date}</p>
        <p><strong>Time:</strong> ${booking.time} to ${booking.endTime}</p>
        <p><strong>Duration:</strong> ${booking.duration} minutes</p>
        <p><strong>Name:</strong> ${booking.name}</p>
        <p><strong>Email:</strong> ${booking.email}</p>
        <p><strong>Phone:</strong> ${booking.phone}</p>
        <p><strong>Notes:</strong> ${booking.notes || "None"}</p>
      </div>
    `,
  };
}

module.exports = {
  SERVICE_DEFINITIONS,
  formatNotificationEmail,
  getResendClient,
  getSupabaseClient,
  json,
  overlapExists,
  parseBody,
  validateBooking,
};
