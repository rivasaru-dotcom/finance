
"use strict";

const BOOKING_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbyCipXv-ZtOY4QxQEh6ai7mrJ_GEWaDpejL9aeIzJhC4kTUzVuwwsl8dBwcVmMwHJ3Kdw/exec",
  timezone: "Australia/Sydney",
  slots: [
    "9:00 AM",
    "9:30 AM",
    "10:30 AM",
    "11:00 AM",
    "1:00 PM",
    "2:30 PM",
    "3:30 PM",
    "4:00 PM"
  ],
  daysToShow: 7
};

document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector) => document.querySelector(selector);

  const form = $("#appointmentForm");
  if (!form) {
    console.error("SILAM booking form was not found.");
    return;
  }

  const dateStrip = $("#dateStrip");
  const timeGrid = $("#timeGrid");
  const monthLabel = $("#monthLabel");
  const dateRangeLabel = $("#dateRangeLabel");
  const selectedDateLabel = $("#selectedDateLabel");
  const selectionSummary = $("#selectionSummary");
  const detailsSlot = $("#detailsSlot");
  const continueBtn = $("#continueBtn");
  const backBtn = $("#backBtn");
  const prevDays = $("#prevDays");
  const nextDays = $("#nextDays");
  const timeStep = $("#timeStep");
  const detailsStep = $("#detailsStep");
  const successStep = $("#successStep");
  const liveAlert = $("#liveAlert");
  const submitBtn = $("#submitBtn");

  const progressTime = $("#progressTime");
  const progressDetails = $("#progressDetails");

  let firstVisibleDate = null;
  let selectedDate = "";
  let selectedTime = "";
  let availabilityRequest = 0;
  let bookingInProgress = false;
  let bookingFrame = null;
  let bookingTimeout = null;

  const availabilityCache = new Map();

  function showMessage(message, type = "info") {
    if (!liveAlert) return;

    liveAlert.textContent = message;
    liveAlert.hidden = !message;
    liveAlert.className = "booking-alert";

    if (type === "error") liveAlert.classList.add("is-error");
    if (type === "success") liveAlert.classList.add("is-success");
  }

  function getSydneyToday() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BOOKING_CONFIG.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const value = {};
    parts.forEach((part) => {
      value[part.type] = part.value;
    });

    return `${value.year}-${value.month}-${value.day}`;
  }

  function parseDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12));
  }

  function dateString(date) {
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  function addDays(date, count) {
    const result = parseDate(dateString(date));
    result.setUTCDate(result.getUTCDate() + count);
    return result;
  }

  function formatDate(date, options = {}) {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "UTC",
      ...options
    }).format(date);
  }

  function dateIsBeforeToday(date) {
    return date < getSydneyToday();
  }

  function formatSelectedSlot(date, time) {
    if (!date || !time) return "Choose a date and time";

    return `${formatDate(parseDate(date), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    })} · ${time} Sydney time`;
  }

  function setBusy(busy) {
    bookingInProgress = busy;

    if (submitBtn) {
      submitBtn.disabled = busy;

      const label = submitBtn.querySelector(".btn-label");
      const loading = submitBtn.querySelector(".btn-loading");

      if (label) label.hidden = busy;
      if (loading) loading.hidden = !busy;
    }

    if (continueBtn) continueBtn.disabled = busy || !selectedDate || !selectedTime;
  }

  function updateSelection() {
    if (selectionSummary) {
      selectionSummary.textContent =
        selectedDate && selectedTime
          ? formatSelectedSlot(selectedDate, selectedTime)
          : "Choose a date and time";
    }

    if (selectedDateLabel) {
      selectedDateLabel.textContent = selectedDate
        ? formatDate(parseDate(selectedDate), {
            weekday: "short",
            day: "numeric",
            month: "short"
          })
        : "Choose a date";
    }

    if (continueBtn) {
      continueBtn.disabled = !selectedDate || !selectedTime || bookingInProgress;
    }
  }

  function showStep(step) {
    const choosingTime = step === "time";
    const enteringDetails = step === "details";
    const completed = step === "success";

    if (timeStep) timeStep.classList.toggle("d-none", !choosingTime);
    if (detailsStep) detailsStep.classList.toggle("d-none", !enteringDetails);
    if (successStep) successStep.classList.toggle("d-none", !completed);

    if (progressTime) {
      progressTime.classList.toggle("is-active", choosingTime);
      progressTime.classList.toggle("is-complete", enteringDetails || completed);
    }

    if (progressDetails) {
      progressDetails.classList.toggle("is-active", enteringDetails);
      progressDetails.classList.toggle("is-complete", completed);
    }

    showMessage("");

    const target = $("#bookingSelection");
    if (target && !completed) {
      // No forced scrolling; preserve the current layout.
    }
  }

  function renderDates() {
    if (!dateStrip || !firstVisibleDate) return;

    dateStrip.replaceChildren();

    const today = getSydneyToday();
    const visibleDates = [];

    for (let i = 0; i < BOOKING_CONFIG.daysToShow; i++) {
      const date = addDays(firstVisibleDate, i);
      const iso = dateString(date);

      if (iso < today) continue;

      visibleDates.push({ date, iso });

      const button = document.createElement("button");
      button.type = "button";
      button.className = "date-option";
      button.classList.toggle("is-selected", iso === selectedDate);
      button.setAttribute("aria-pressed", String(iso === selectedDate));

      const day = document.createElement("span");
      day.className = "date-option-day";
      day.textContent = formatDate(date, { weekday: "short" });

      const number = document.createElement("strong");
      number.className = "date-option-number";
      number.textContent = formatDate(date, { day: "numeric" });

      const month = document.createElement("span");
      month.className = "date-option-month";
      month.textContent = formatDate(date, { month: "short" });

      button.append(day, number, month);

      button.addEventListener("click", () => {
        selectedDate = iso;
        selectedTime = "";

        renderDates();
        updateSelection();
        loadAvailability(iso);
      });

      dateStrip.appendChild(button);
    }

    if (visibleDates.length) {
      const first = visibleDates[0].date;
      const last = visibleDates[visibleDates.length - 1].date;

      if (monthLabel) {
        monthLabel.textContent = formatDate(first, {
          month: "long",
          year: "numeric"
        });
      }

      if (dateRangeLabel) {
        dateRangeLabel.textContent =
          `${formatDate(first, { day: "numeric", month: "short" })} – ` +
          `${formatDate(last, { day: "numeric", month: "short" })}`;
      }
    }

    if (prevDays) {
      prevDays.disabled = dateString(firstVisibleDate) <= today;
    }
  }

  function renderTimes(times, loading = false) {
    if (!timeGrid) return;

    timeGrid.replaceChildren();

    if (loading) {
      const note = document.createElement("p");
      note.className = "time-grid-message";
      note.textContent = "Loading available times…";
      timeGrid.appendChild(note);
      return;
    }

    if (!times.length) {
      const note = document.createElement("p");
      note.className = "time-grid-message";
      note.textContent = selectedDate
        ? "No appointments are available on this date. Try another date."
        : "Choose a date to see available times.";
      timeGrid.appendChild(note);
      return;
    }

    times.forEach((time) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "time-option";
      button.textContent = time;
      button.classList.toggle("is-selected", time === selectedTime);
      button.setAttribute("aria-pressed", String(time === selectedTime));

      button.addEventListener("click", () => {
        selectedTime = time;
        renderTimes(times);
        updateSelection();
        showMessage("");
      });

      timeGrid.appendChild(button);
    });
  }

  function loadAvailability(date) {
    const requestId = ++availabilityRequest;

    selectedTime = "";
    updateSelection();
    renderTimes([], true);

    if (!date || dateIsBeforeToday(date)) {
      renderTimes([]);
      return;
    }

    if (availabilityCache.has(date)) {
      renderTimes(availabilityCache.get(date));
      return;
    }

    const callbackName =
      "__silamAvailability_" +
      Date.now() + "_" +
      Math.random().toString(36).slice(2);

    let script = null;
    let timeout = null;
    let finished = false;

    function cleanup() {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (script) script.remove();

      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }
    }

    function fail(message) {
      cleanup();
      if (requestId !== availabilityRequest) return;

      renderTimes([]);
      showMessage(message, "error");
    }

    window[callbackName] = (result) => {
      cleanup();

      if (requestId !== availabilityRequest) return;

      if (!result || result.success !== true || !Array.isArray(result.available)) {
        fail(result && result.message
          ? result.message
          : "Availability could not be loaded.");
        return;
      }

      const available = result.available.filter((time) =>
        BOOKING_CONFIG.slots.includes(time)
      );

      availabilityCache.set(date, available);
      renderTimes(available);

      if (!available.length) {
        showMessage("No times are available on this date.");
      } else {
        showMessage("Select an available time.");
      }
    };

    try {
      const url = new URL(BOOKING_CONFIG.endpoint);
      url.searchParams.set("action", "availability");
      url.searchParams.set("date", date);
      url.searchParams.set("callback", callbackName);

      script = document.createElement("script");
      script.src = url.toString();
      script.async = true;

      script.onerror = () => fail(
        "Could not connect to Google Calendar. Check the Apps Script JSONP deployment."
      );

      timeout = setTimeout(() => fail(
        "Availability request timed out. Please try again."
      ), 15000);

      document.head.appendChild(script);
    } catch (error) {
      fail(error.message || "Could not load availability.");
    }
  }

  function moveDays(direction) {
    firstVisibleDate = addDays(firstVisibleDate, direction * BOOKING_CONFIG.daysToShow);

    const today = getSydneyToday();

    if (dateString(firstVisibleDate) < today) {
      firstVisibleDate = parseDate(today);
    }

    renderDates();

    // Preserve the selection only if it is still in the visible range.
    const start = dateString(firstVisibleDate);
    const end = dateString(addDays(firstVisibleDate, BOOKING_CONFIG.daysToShow - 1));

    if (selectedDate && (selectedDate < start || selectedDate > end)) {
      selectedDate = "";
      selectedTime = "";
      renderTimes([]);
      updateSelection();
    }
  }

  if (prevDays) {
    prevDays.addEventListener("click", () => moveDays(-1));
  }

  if (nextDays) {
    nextDays.addEventListener("click", () => moveDays(1));
  }

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (!selectedDate || !selectedTime) {
        showMessage("Please choose a date and time first.", "error");
        return;
      }

      if (detailsSlot) {
        detailsSlot.textContent = formatSelectedSlot(selectedDate, selectedTime);
      }

      showStep("details");
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => showStep("time"));
  }

  function createBookingFrame() {
    bookingFrame = document.createElement("iframe");
    bookingFrame.name = "silamBookingFrame_" + Math.random().toString(36).slice(2);
    bookingFrame.title = "Appointment booking response";
    bookingFrame.hidden = true;
    document.body.appendChild(bookingFrame);

    window.addEventListener("message", (event) => {
      if (!bookingFrame || event.source !== bookingFrame.contentWindow) return;
      if (!event.data || event.data.type !== "silam-booking-result") return;
      if (!bookingInProgress) return;

      clearTimeout(bookingTimeout);
      setBusy(false);

      const result = event.data.payload;

      if (result && result.success === true) {
        if ($("#successSlot")) {
          $("#successSlot").textContent = formatSelectedSlot(selectedDate, selectedTime);
        }

        if ($("#successMessage")) {
          $("#successMessage").textContent =
            "Your consultation has been booked. Please check your email for the calendar invitation.";
        }

        if ($("#confirmationCode")) {
          $("#confirmationCode").textContent =
            result.eventId ? "Booking reference: " + result.eventId : "";
        }

        showStep("success");
        availabilityCache.delete(selectedDate);
        return;
      }

      showStep("details");
      showMessage(
        result && result.message
          ? result.message
          : "The booking could not be confirmed. Check your calendar before trying again.",
        "error"
      );

      availabilityCache.delete(selectedDate);
      loadAvailability(selectedDate);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (bookingInProgress) return;

    if (!selectedDate || !selectedTime) {
      showStep("time");
      showMessage("Please select an available appointment time.", "error");
      return;
    }

    const firstName = $("#firstName");
    const lastName = $("#lastName");
    const email = $("#email");
    const phone = $("#phone");
    const reason = $("#reason");
    const message = $("#message");
    const consent = $("#consent");

    if (!form.reportValidity()) return;

    if (consent && !consent.checked) {
      showMessage("Please confirm the consultation consent before continuing.", "error");
      consent.focus();
      return;
    }

    const values = {
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      reason: reason.value.trim(),
      message: message ? message.value.trim() : "",
      isoDate: selectedDate,
      time: selectedTime,
      _iframe: "1"
    };

    if (!bookingFrame) createBookingFrame();

    const hiddenForm = document.createElement("form");
    hiddenForm.method = "POST";
    hiddenForm.action = BOOKING_CONFIG.endpoint;
    hiddenForm.target = bookingFrame.name;
    hiddenForm.hidden = true;

    Object.entries(values).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      hiddenForm.appendChild(input);
    });

    document.body.appendChild(hiddenForm);

    setBusy(true);
    showMessage("Submitting your appointment request…");

    bookingTimeout = setTimeout(() => {
      if (!bookingInProgress) return;

      setBusy(false);
      showMessage(
        "We couldn't confirm the response. Check Google Calendar before trying to book again.",
        "error"
      );
    }, 30000);

    try {
      hiddenForm.submit();
    } catch (error) {
      clearTimeout(bookingTimeout);
      setBusy(false);
      showMessage("Unable to submit your booking. Please try again.", "error");
    }

    setTimeout(() => hiddenForm.remove(), 1000);
  });

  // Initialise the custom calendar.
  firstVisibleDate = parseDate(getSydneyToday());
  renderDates();
  renderTimes([]);
  updateSelection();
  showStep("time");
});
