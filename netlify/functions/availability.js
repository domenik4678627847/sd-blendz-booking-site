const { getSupabaseClient, json } = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, {});
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Method not allowed." });
  }

  const date = event.queryStringParameters?.date;

  if (!date) {
    return json(400, { error: "A date query parameter is required." });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("customer_name, service, price, duration_minutes, appointment_date, start_time, end_time")
      .eq("appointment_date", date)
      .gte("end_time", "00:00:00")
      .order("start_time", { ascending: true });

    if (error) {
      throw error;
    }

    const now = new Date();
    const bookings = (data || [])
      .map((row) => ({
        name: row.customer_name,
        service: row.service,
        price: row.price,
        duration: row.duration_minutes,
        date: row.appointment_date,
        time: row.start_time.slice(0, 5),
        endTime: row.end_time.slice(0, 5),
      }))
      .filter((booking) => {
        const end = new Date(`${booking.date}T${booking.endTime}:00`);
        return end.getTime() > now.getTime();
      });

    return json(200, { bookings });
  } catch (error) {
    return json(500, { error: error.message || "Unable to load bookings." });
  }
};

