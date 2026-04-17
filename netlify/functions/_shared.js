const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

const SERVICE_DEFINITIONS = {
  "Classic Fade": { price: "$20", duration: 60 },
  "Fade + Design": { price: "$20", duration: 60 },
  "Buzz Cut": { price: "$20", duration: 60 },
  "Beard Trim + Lineup": { price: "$20", duration: 60 },
  "Cut + Beard Combo": { price: "$20", duration: 60 },
  "Other Custom Style": { price: "$20", duration: 60 },
};
const BARBER_OPTIONS = ["Shae", "Domenik"];

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

  if (!BARBER_OPTIONS.includes(payload.barber)) {
    throw new Error("Selected barber is not valid.");
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
    subject: `New S&D Blendz booking with ${booking.barber} for ${booking.date} at ${booking.time}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>New S&amp;D Blendz booking</h2>
        <p><strong>Barber:</strong> ${booking.barber}</p>
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

function parseStoredNotes(value) {
  const raw = value || "";
  const match = raw.match(/^\[barber:([^\]]+)\]\s*/i);
  const barber = match?.[1] || "Domenik";
  const notes = raw.replace(/^\[barber:[^\]]+\]\s*/i, "").trim();
  return { barber, notes };
}

function buildStoredNotes(barber, notes) {
  const trimmedNotes = (notes || "").trim();
  return trimmedNotes ? `[barber:${barber}] ${trimmedNotes}` : `[barber:${barber}]`;
}

module.exports = {
  BARBER_OPTIONS,
  SERVICE_DEFINITIONS,
  buildStoredNotes,
  formatNotificationEmail,
  getResendClient,
  getSupabaseClient,
  json,
  overlapExists,
  parseStoredNotes,
  parseBody,
  validateBooking,
};
