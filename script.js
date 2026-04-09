const APPOINTMENT_STEP_MINUTES = 30;
const STORAGE_KEY = "sd-blendz-bookings-local-fallback-v1";
const BOOKING_API_BASE = window.BOOKING_API_BASE || "";
const SCHEDULE = {
  openingHour: 16,
  openingMinute: 0,
  closingHour: 20,
  closingMinute: 30,
};

const SERVICE_DEFINITIONS = {
  "Classic Fade": { price: "$30", duration: 30 },
  "Fade + Design": { price: "$35", duration: 30 },
  "Buzz Cut": { price: "$30", duration: 30 },
  "Beard Trim + Lineup": { price: "$35", duration: 30 },
  "Cut + Beard Combo": { price: "$30", duration: 45 },
  "Other Custom Style": { price: "$30", duration: 45 },
};

const dateInput = document.querySelector("#appointment-date");
const slotsGrid = document.querySelector("#slots-grid");
const slotMessage = document.querySelector("#slot-message");
const slotsSubtitle = document.querySelector("#slots-subtitle");
const bookingForm = document.querySelector("#booking-form");
const feedback = document.querySelector("#form-feedback");
const dayBookings = document.querySelector("#day-bookings");
const summaryDate = document.querySelector("#summary-date");
const summaryTime = document.querySelector("#summary-time");
const summaryService = document.querySelector("#summary-service");
const summaryDuration = document.querySelector("#summary-duration");
const serviceInputs = Array.from(document.querySelectorAll('input[name="service-type"]'));

const nameInput = document.querySelector("#client-name");
const emailInput = document.querySelector("#client-email");
const phoneInput = document.querySelector("#client-phone");
const notesInput = document.querySelector("#client-notes");

let selectedTime = "";
let selectedDateBookings = [];
let bookingMode = "loading";

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInputValue(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function getNextWeekday(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  while (!isWeekday(next)) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function getSelectedServiceInput() {
  return serviceInputs.find((input) => input.checked) || null;
}

function getSelectedServiceDetails() {
  const selectedServiceInput = getSelectedServiceInput();

  if (!selectedServiceInput) {
    return null;
  }

  return {
    name: selectedServiceInput.value,
    price: selectedServiceInput.dataset.price,
    duration: Number(selectedServiceInput.dataset.duration),
  };
}

function getSlotTimes(selectedDuration = APPOINTMENT_STEP_MINUTES) {
  const slots = [];
  let totalMinutes = SCHEDULE.openingHour * 60 + SCHEDULE.openingMinute;
  const closingMinutes = SCHEDULE.closingHour * 60 + SCHEDULE.closingMinute;
  const latestStart = closingMinutes - selectedDuration;

  while (totalMinutes <= latestStart) {
    slots.push(minutesToTimeValue(totalMinutes));
    totalMinutes += APPOINTMENT_STEP_MINUTES;
  }

  return slots;
}

function formatTimeLabel(timeValue) {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function timeValueToMinutes(timeValue) {
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTimeValue(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

function formatDurationLabel(duration) {
  return `${duration} minutes`;
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getBookingStartDateTime(dateValue, timeValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function isExpiredBooking(booking) {
  if (!booking?.date || !booking?.time) {
    return false;
  }

  const bookingDuration = Number(booking.duration || APPOINTMENT_STEP_MINUTES);
  const start = getBookingStartDateTime(booking.date, booking.time);
  const end = new Date(start.getTime() + bookingDuration * 60 * 1000);
  return end.getTime() <= Date.now();
}

function loadLocalFallbackBookings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!Array.isArray(stored)) {
      return [];
    }

    const cleaned = stored.filter((booking) => !isExpiredBooking(booking));

    if (cleaned.length !== stored.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch (error) {
    return [];
  }
}

function saveLocalFallbackBookings(bookings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function getLocalBookingsForDate(dateValue) {
  return loadLocalFallbackBookings()
    .filter((booking) => booking.date === dateValue)
    .sort((first, second) => first.time.localeCompare(second.time));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${BOOKING_API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Something went wrong.";

    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch (error) {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return response.json();
}

async function loadBookingsForDate(dateValue) {
  if (!dateValue) {
    selectedDateBookings = [];
    return;
  }

  try {
    const payload = await apiRequest(`/.netlify/functions/availability?date=${encodeURIComponent(dateValue)}`);
    bookingMode = "api";
    selectedDateBookings = Array.isArray(payload.bookings) ? payload.bookings : [];
  } catch (error) {
    bookingMode = "local";
    selectedDateBookings = getLocalBookingsForDate(dateValue);
    setSlotMessage("Live booking service is unavailable right now, so this page is using local demo mode.", "error");
  }
}

function setFeedback(message = "", type = "") {
  feedback.textContent = message;
  feedback.className = "form-feedback";

  if (type) {
    feedback.classList.add(type);
  }
}

function setSlotMessage(message = "", type = "") {
  slotMessage.textContent = message;
  slotMessage.className = "slot-message";

  if (type) {
    slotMessage.classList.add(type);
  }
}

function renderSummary() {
  const selectedService = getSelectedServiceDetails();
  summaryService.textContent = selectedService
    ? `${selectedService.name} | ${selectedService.price}`
    : "Choose a haircut service";
  summaryDuration.textContent = selectedService
    ? formatDurationLabel(selectedService.duration)
    : "Depends on the service";

  if (!dateInput.value) {
    summaryDate.textContent = "Choose a date";
    summaryTime.textContent = "Pick a time slot";
    return;
  }

  summaryDate.textContent = formatDateLabel(fromDateInputValue(dateInput.value));
  summaryTime.textContent = selectedTime ? formatTimeLabel(selectedTime) : "Pick a time slot";
}

function renderDayBookings() {
  dayBookings.innerHTML = "";

  if (!dateInput.value) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Pick a date to review that day's bookings.";
    dayBookings.appendChild(emptyState);
    return;
  }

  if (selectedDateBookings.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "No appointments booked yet for this date.";
    dayBookings.appendChild(emptyState);
    return;
  }

  selectedDateBookings.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "booking-chip";

    const time = document.createElement("strong");
    time.textContent = `${formatTimeLabel(entry.time)} - ${formatTimeLabel(entry.endTime)}`;

    const details = document.createElement("span");
    details.textContent = `${entry.name} | ${entry.service} | ${formatDurationLabel(entry.duration || 30)}`;

    item.append(time, details);
    dayBookings.appendChild(item);
  });
}

function selectSlot(timeValue) {
  selectedTime = timeValue;
  renderSlots();
  renderSummary();
  setFeedback("", "");
}

function getAvailableTimes() {
  const selectedService = getSelectedServiceDetails();
  const selectedDuration = selectedService ? selectedService.duration : APPOINTMENT_STEP_MINUTES;
  const slotTimes = getSlotTimes(selectedDuration);

  return slotTimes.filter((timeValue) => {
    const candidateStart = timeValueToMinutes(timeValue);
    const candidateEnd = candidateStart + selectedDuration;

    return selectedDateBookings.every((entry) => {
      const bookingStart = timeValueToMinutes(entry.time);
      const bookingDuration = Number(entry.duration || APPOINTMENT_STEP_MINUTES);
      const bookingEnd = bookingStart + bookingDuration;
      return candidateEnd <= bookingStart || candidateStart >= bookingEnd;
    });
  });
}

function renderSlots() {
  slotsGrid.innerHTML = "";

  if (!dateInput.value) {
    slotsSubtitle.textContent = "Select a weekday to see the open slots.";
    setSlotMessage("Choose a date to load the available appointments.", "");
    renderSummary();
    renderDayBookings();
    return;
  }

  const selectedDate = fromDateInputValue(dateInput.value);

  if (!isWeekday(selectedDate)) {
    slotsSubtitle.textContent = "Weekend dates are unavailable.";
    setSlotMessage("Please pick a Monday to Friday date.", "error");
    renderSummary();
    renderDayBookings();
    return;
  }

  const selectedService = getSelectedServiceDetails();
  const selectedDuration = selectedService ? selectedService.duration : APPOINTMENT_STEP_MINUTES;
  const slotTimes = getSlotTimes(selectedDuration);
  const availableTimes = getAvailableTimes();
  const availableTimeSet = new Set(availableTimes);
  const remainingCount = availableTimes.length;

  slotsSubtitle.textContent = `${remainingCount} slot${remainingCount === 1 ? "" : "s"} open on ${formatDateLabel(selectedDate)}.`;

  slotTimes.forEach((timeValue) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot-button";
    button.textContent = formatTimeLabel(timeValue);
    button.setAttribute("role", "listitem");

    if (!availableTimeSet.has(timeValue)) {
      button.classList.add("booked");
      button.disabled = true;
      button.textContent = `${formatTimeLabel(timeValue)} Unavailable`;
    } else {
      button.addEventListener("click", () => selectSlot(timeValue));
    }

    if (selectedTime === timeValue) {
      button.classList.add("selected");
    }

    slotsGrid.appendChild(button);
  });

  if (remainingCount === 0) {
    selectedTime = "";
    setSlotMessage("No start times fit this service on that date. Please choose another date or service.", "error");
  } else if (bookingMode === "api") {
    setSlotMessage(`Select one available start time for this ${formatDurationLabel(selectedDuration).toLowerCase()} service. Live booking mode is on.`, "success");
  } else if (bookingMode === "local") {
    setSlotMessage(`Select one available start time for this ${formatDurationLabel(selectedDuration).toLowerCase()} service. Demo mode is active until the live booking backend is connected.`, "error");
  } else {
    setSlotMessage("Loading available appointment times.", "");
  }

  renderSummary();
  renderDayBookings();
}

function moveWeekendSelectionToWeekday() {
  const selectedDate = fromDateInputValue(dateInput.value);

  if (isWeekday(selectedDate)) {
    return;
  }

  const adjustedDate = getNextWeekday(selectedDate);
  dateInput.value = toDateInputValue(adjustedDate);
  selectedTime = "";
  setSlotMessage(`Weekend dates are unavailable. Moved to ${formatDateLabel(adjustedDate)}.`, "error");
}

function initializeDateInput() {
  const today = new Date();
  const nextWeekday = getNextWeekday(today);

  dateInput.min = toDateInputValue(nextWeekday);
  dateInput.value = toDateInputValue(nextWeekday);
}

async function refreshAvailability() {
  if (!dateInput.value) {
    selectedDateBookings = [];
    renderSlots();
    return;
  }

  await loadBookingsForDate(dateInput.value);
  renderSlots();
}

dateInput.addEventListener("change", async () => {
  selectedTime = "";
  setFeedback("", "");
  moveWeekendSelectionToWeekday();
  await refreshAvailability();
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!dateInput.value) {
    setFeedback("Choose a date before booking.", "error");
    return;
  }

  const chosenDate = fromDateInputValue(dateInput.value);

  if (!isWeekday(chosenDate)) {
    setFeedback("Appointments can only be booked Monday to Friday.", "error");
    return;
  }

  if (!selectedTime) {
    setFeedback("Pick an available time slot before confirming.", "error");
    return;
  }

  const selectedService = getSelectedServiceDetails();

  if (!selectedService) {
    setFeedback("Choose a haircut service before confirming the booking.", "error");
    return;
  }

  if (!nameInput.value.trim() || !emailInput.value.trim() || !phoneInput.value.trim()) {
    setFeedback("Please fill in your name, email, and phone number.", "error");
    return;
  }

  const endTime = minutesToTimeValue(timeValueToMinutes(selectedTime) + selectedService.duration);
  const bookingPayload = {
    date: dateInput.value,
    time: selectedTime,
    endTime,
    service: selectedService.name,
    price: selectedService.price,
    duration: selectedService.duration,
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim(),
    notes: notesInput.value.trim(),
  };

  const button = bookingForm.querySelector('button[type="submit"]');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Saving booking...";

  try {
    if (bookingMode === "api") {
      await apiRequest("/.netlify/functions/bookings", {
        method: "POST",
        body: JSON.stringify(bookingPayload),
      });
    } else {
      const existingBookings = loadLocalFallbackBookings();
      existingBookings.push({
        ...bookingPayload,
        bookedAt: new Date().toISOString(),
      });
      saveLocalFallbackBookings(existingBookings);
    }

    const confirmationTime = selectedTime;
    selectedTime = "";
    bookingForm.reset();
    setFeedback(
      `Booked ${selectedService.name} for ${formatDateLabel(chosenDate)} at ${formatTimeLabel(confirmationTime)}.`,
      "success"
    );
    await refreshAvailability();
  } catch (error) {
    setFeedback(error.message || "Unable to save the booking right now.", "error");
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
    renderSummary();
  }
});

serviceInputs.forEach((input) => {
  input.addEventListener("change", () => {
    selectedTime = "";
    renderSlots();
    renderSummary();
    setFeedback("", "");
  });
});

initializeDateInput();
refreshAvailability();
