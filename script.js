const STORAGE_KEY = "crown-barber-bookings-v1";
const APPOINTMENT_LENGTH_MINUTES = 30;
const SCHEDULE = {
  openingHour: 16,
  openingMinute: 0,
  closingHour: 20,
  closingMinute: 30,
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

function loadBookings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored && typeof stored === "object" ? stored : {};
  } catch (error) {
    return {};
  }
}

let bookings = loadBookings();

function saveBookings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

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

function getSlotTimes() {
  const slots = [];
  let totalMinutes = SCHEDULE.openingHour * 60 + SCHEDULE.openingMinute;
  const closingMinutes = SCHEDULE.closingHour * 60 + SCHEDULE.closingMinute;
  const selectedServiceInput = serviceInputs.find((input) => input.checked);
  const duration = selectedServiceInput ? Number(selectedServiceInput.dataset.duration) : APPOINTMENT_LENGTH_MINUTES;
  const latestStart = closingMinutes - duration;

  while (totalMinutes <= latestStart) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    slots.push(`${pad(hours)}:${pad(minutes)}`);
    totalMinutes += APPOINTMENT_LENGTH_MINUTES;
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

function getBookingsForDate(dateValue) {
  return Array.isArray(bookings[dateValue]) ? [...bookings[dateValue]] : [];
}

function sortBookingsForDate(dateValue) {
  bookings[dateValue] = getBookingsForDate(dateValue).sort((first, second) => {
    return first.time.localeCompare(second.time);
  });
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
  const selectedServiceInput = serviceInputs.find((input) => input.checked);
  summaryService.textContent = selectedServiceInput
    ? `${selectedServiceInput.value} • ${selectedServiceInput.dataset.price}`
    : "Choose a haircut service";
  summaryDuration.textContent = selectedServiceInput
    ? formatDurationLabel(Number(selectedServiceInput.dataset.duration))
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

  const entries = getBookingsForDate(dateInput.value);

  if (entries.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "No appointments booked yet for this date.";
    dayBookings.appendChild(emptyState);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "booking-chip";

    const time = document.createElement("strong");
    time.textContent = formatTimeLabel(entry.time);

    const name = document.createElement("span");
    name.textContent = `${entry.name} • ${entry.service} • ${formatDurationLabel(entry.duration || 30)}`;

    item.append(time, name);
    dayBookings.appendChild(item);
  });
}

function selectSlot(timeValue) {
  selectedTime = timeValue;
  renderSlots();
  renderSummary();
  setFeedback("", "");
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

  const slotTimes = getSlotTimes();
  const selectedServiceInput = serviceInputs.find((input) => input.checked);
  const selectedDuration = selectedServiceInput ? Number(selectedServiceInput.dataset.duration) : APPOINTMENT_LENGTH_MINUTES;
  const existingBookings = getBookingsForDate(dateInput.value);
  const availableTimes = slotTimes.filter((timeValue) => {
    const candidateStart = timeValueToMinutes(timeValue);
    const candidateEnd = candidateStart + selectedDuration;

    return existingBookings.every((entry) => {
      const bookingStart = timeValueToMinutes(entry.time);
      const bookingDuration = Number(entry.duration || 30);
      const bookingEnd = bookingStart + bookingDuration;
      return candidateEnd <= bookingStart || candidateStart >= bookingEnd;
    });
  });
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
  } else {
    setSlotMessage(`Select one available start time for this ${formatDurationLabel(selectedDuration).toLowerCase()} service.`, "success");
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

dateInput.addEventListener("change", () => {
  selectedTime = "";
  setFeedback("", "");
  moveWeekendSelectionToWeekday();
  renderSlots();
});

bookingForm.addEventListener("submit", (event) => {
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

  const selectedServiceInput = serviceInputs.find((input) => input.checked);

  if (!selectedServiceInput) {
    setFeedback("Choose a haircut service before confirming the booking.", "error");
    return;
  }

  if (!nameInput.value.trim() || !emailInput.value.trim() || !phoneInput.value.trim()) {
    setFeedback("Please fill in your name, email, and phone number.", "error");
    return;
  }

  const existingBookings = getBookingsForDate(dateInput.value);
  const alreadyTaken = existingBookings.some((entry) => entry.time === selectedTime);

  if (alreadyTaken) {
    selectedTime = "";
    renderSlots();
    setFeedback("That time was just taken. Please choose another slot.", "error");
    return;
  }

  const newBooking = {
    time: selectedTime,
    endTime: minutesToTimeValue(timeValueToMinutes(selectedTime) + Number(selectedServiceInput.dataset.duration)),
    service: selectedServiceInput.value,
    price: selectedServiceInput.dataset.price,
    duration: Number(selectedServiceInput.dataset.duration),
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim(),
    notes: notesInput.value.trim(),
    bookedAt: new Date().toISOString(),
  };

  bookings[dateInput.value] = [...existingBookings, newBooking];
  sortBookingsForDate(dateInput.value);
  saveBookings();

  const confirmationTime = selectedTime;
  selectedTime = "";
  bookingForm.reset();
  initializeDateInput();
  dateInput.value = toDateInputValue(chosenDate);

  renderSlots();
  renderSummary();
  setFeedback(
    `Booked ${selectedServiceInput.value} for ${formatDateLabel(chosenDate)} at ${formatTimeLabel(confirmationTime)}.`,
    "success"
  );
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
renderSlots();
renderSummary();
