const {
  formatNotificationEmail,
  getResendClient,
  getSupabaseClient,
  json,
  overlapExists,
  parseBody,
  validateBooking,
} = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const payload = validateBooking(parseBody(event));
    const supabase = getSupabaseClient();

    const { data: existingRows, error: existingError } = await supabase
      .from("bookings")
      .select("appointment_date, start_time, duration_minutes")
      .eq("appointment_date", payload.date)
      .order("start_time", { ascending: true });

    if (existingError) {
      throw existingError;
    }

    const activeBookings = (existingRows || []).map((row) => ({
      date: row.appointment_date,
      time: row.start_time.slice(0, 5),
      duration: row.duration_minutes,
    }));

    if (overlapExists(activeBookings, payload)) {
      return json(409, { error: "That appointment time is no longer available." });
    }

    const { error: insertError } = await supabase.from("bookings").insert({
      customer_name: payload.name,
      customer_email: payload.email,
      customer_phone: payload.phone,
      service: payload.service,
      price: payload.price,
      duration_minutes: payload.duration,
      appointment_date: payload.date,
      start_time: `${payload.time}:00`,
      end_time: `${payload.endTime}:00`,
      notes: payload.notes || null,
    });

    if (insertError) {
      throw insertError;
    }

    const { client: resendClient, fromEmail, notifyEmail } = getResendClient();
    const email = formatNotificationEmail(payload);

    const emailResult = await resendClient.emails.send({
      from: fromEmail,
      to: notifyEmail,
      subject: email.subject,
      html: email.html,
    });

    if (emailResult?.error) {
      throw new Error(emailResult.error.message || "Email notification failed.");
    }

    return json(201, { success: true });
  } catch (error) {
    return json(500, { error: error.message || "Unable to create booking." });
  }
};
