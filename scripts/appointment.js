"use strict";

const BOOKING_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbyCipXv-ZtOY4QxQEh6ai7mrJ_GEWaDpejL9aeIzJhC4kTUzVuwwsl8dBwcVmMwHJ3Kdw/exec",
  timezone: "Australia/Sydney",
  durationMinutes: 30,
  slots: [
    "9:00 AM",
    "9:30 AM",
    "10:30 AM",
    "11:00 AM",
    "1:00 PM",
    "2:30 PM",
    "3:30 PM",
    "4:00 PM"
  ]
};

(() => {
  const form =
    document.querySelector("#appointmentForm") ||
    document.querySelector("#bookingForm");

  if (!form) {
    console.error(
      "Appointment form not found. Add id='appointmentForm' to your form."
    );
    return;
  }

  const dateInput =
    form.querySelector('[name="isoDate"]') ||
    form.querySelector("#appointmentDate") ||
    form.querySelector("#bookingDate");

  const timeSelect =
    form.querySelector('[name="time"]') ||
    form.querySelector("#appointmentTime") ||
    form.querySelector("#bookingTime");

  const submitButton =
    form.querySelector('[type="submit"]');

  const statusElement =
    document.querySelector("#appointmentStatus") ||
    document.querySelector("#bookingStatus") ||
    document.querySelector("#formMessage");

  let availabilityRequest = 0;
  let bookingInProgress = false;
  let bookingTimeout = null;

  // Set this to the deployed /exec URL in BOOKING_CONFIG.
  function getEndpoint() {
    const endpoint = BOOKING_CONFIG.endpoint.trim();

    if (
      !endpoint.startsWith("https://script.google.com/") ||
      !endpoint.endsWith("/exec")
    ) {
      throw new Error(
        "Add your deployed Google Apps Script /exec URL to appointment.js."
      );
    }

    return endpoint;
  }

  function showStatus(message, type = "info") {
    if (!statusElement) {
      console.log(message);
      return;
    }

    statusElement.textContent = message;
    statusElement.setAttribute("role", "status");
    statusElement.setAttribute("aria-live", "polite");

    statusElement.classList.remove(
      "success",
      "error",
      "info"
    );
    statusElement.classList.add(type);

    statusElement.style.color =
      type === "error" ? "#b42318" :
      type === "success" ? "#237a57" :
      "";
  }

  function setSubmitting(isSubmitting) {
    if (submitButton) {
      submitButton.disabled = isSubmitting;
      submitButton.setAttribute(
        "aria-busy",
        String(isSubmitting)
      );
    }

    if (isSubmitting) {
      form.setAttribute("aria-busy", "true");
    } else {
      form.removeAttribute("aria-busy");
    }
  }

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function configureDateInput() {
    if (!dateInput) {
      console.error("Appointment date input not found.");
      return;
    }

    // Use the visitor's current date as a basic minimum.
    // The backend independently validates the Sydney appointment time.
    dateInput.min = localDateString(new Date());
  }

  function setTimeOptions(times, placeholder) {
    if (!timeSelect) return;

    timeSelect.replaceChildren();

    timeSelect.add(new Option(placeholder, ""));

    times.forEach((time) => {
      if (BOOKING_CONFIG.slots.includes(time)) {
        timeSelect.add(new Option(time, time));
      }
    });

    timeSelect.disabled = times.length === 0;
  }

  // JSONP is used because a normal cross-origin fetch to Apps Script
  // may fail due to redirects or CORS.
  function loadAvailability(date) {
    if (!dateInput || !timeSelect) return;

    const requestId = ++availabilityRequest;

    if (!date) {
      setTimeOptions([], "Choose a date first");
      showStatus("");
      return;
    }

    setTimeOptions([], "Loading available times...");
    timeSelect.disabled = true;

    showStatus("Checking available appointments...");

    let script;
    let timeout;

    const callbackName =
      "__silamAvailability_" +
      Date.now() + "_" +
      Math.random().toString(36).slice(2);

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

    window[callbackName] = function(result) {
      cleanup();

      if (requestId !== availabilityRequest) return;

      if (!result || result.success !== true) {
        setTimeOptions([], "Availability unavailable");
        showStatus(
          result && result.message
            ? result.message
            : "Could not retrieve availability.",
          "error"
        );
        return;
      }

      const available = Array.isArray(result.available)
        ? result.available.filter((time) =>
            BOOKING_CONFIG.slots.includes(time)
          )
        : [];

      if (available.length === 0) {
        setTimeOptions([], "No times available");
        showStatus(
          "There are no available appointments on this date.",
          "info"
        );
        return;
      }

      setTimeOptions(available, "Select an appointment time");
      showStatus("Choose an available appointment time.");
    };

    try {
      const url = new URL(getEndpoint());

      url.searchParams.set("action", "availability");
      url.searchParams.set("date", date);
      url.searchParams.set("callback", callbackName);

      script = document.createElement("script");
      script.src = url.toString();
      script.async = true;

      script.onerror = function() {
        cleanup();

        if (requestId !== availabilityRequest) return;

        setTimeOptions([], "Unable to load times");

        showStatus(
          "Availability could not be loaded. Check your Apps Script deployment and JSONP setup.",
          "error"
        );
      };

      timeout = setTimeout(() => {
        cleanup();

        if (requestId !== availabilityRequest) return;

        setTimeOptions([], "Request timed out");

        showStatus(
          "The availability request timed out. Please try again.",
          "error"
        );
      }, 15000);

      document.head.appendChild(script);

    } catch (error) {
      cleanup();
      setTimeOptions([], "Unable to load times");
      showStatus(error.message, "error");
    }
  }

  // Receive the result returned by the Apps Script HTML response.
  function handleBookingMessage(event) {
    if (!bookingInProgress) return;

    if (
      !bookingFrame ||
      event.source !== bookingFrame.contentWindow
    ) {
      return;
    }

    if (
      !event.data ||
      event.data.type !== "silam-booking-result"
    ) {
      return;
    }

    clearTimeout(bookingTimeout);
    bookingInProgress = false;
    setSubmitting(false);

    const result = event.data.payload;

    if (result && result.success === true) {
      showStatus(
        "Your appointment has been booked successfully. Please check your email for the invitation.",
        "success"
      );

      form.reset();
      configureDateInput();
      setTimeOptions([], "Choose a date first");

      return;
    }

    showStatus(
      result && result.message
        ? result.message
        : "Your appointment could not be confirmed. Check your calendar before trying again.",
      "error"
    );

    if (dateInput && dateInput.value) {
      loadAvailability(dateInput.value);
    }
  }

  let bookingFrame = null;

  function createBookingFrame() {
    bookingFrame = document.createElement("iframe");
    bookingFrame.name =
      "silamBookingFrame_" + Math.random().toString(36).slice(2);

    bookingFrame.title = "Appointment booking response";
    bookingFrame.hidden = true;

    document.body.appendChild(bookingFrame);

    window.addEventListener("message", handleBookingMessage);
  }

  function submitBooking(event) {
    event.preventDefault();

    if (bookingInProgress) return;

    if (!form.reportValidity()) return;

    if (!dateInput || !timeSelect || !timeSelect.value) {
      showStatus(
        "Please select an available appointment date and time.",
        "error"
      );
      return;
    }

    if (!BOOKING_CONFIG.slots.includes(timeSelect.value)) {
      showStatus("Please choose a valid appointment time.", "error");
      return;
    }

    let endpoint;

    try {
      endpoint = getEndpoint();
    } catch (error) {
      showStatus(error.message, "error");
      return;
    }

    const formData = new FormData(form);
    const values = {};

    [
      "firstName",
      "lastName",
      "email",
      "phone",
      "reason",
      "message"
    ].forEach((key) => {
      const value = formData.get(key);
      values[key] = value == null ? "" : String(value).trim();
    });

    values.isoDate = dateInput.value;
    values.time = timeSelect.value;

    const required = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "reason",
      "isoDate",
      "time"
    ];

    if (required.some((key) => !values[key])) {
      showStatus("Please complete all required fields.", "error");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      showStatus("Please enter a valid email address.", "error");
      return;
    }

    if (!bookingFrame) createBookingFrame();

    const hiddenForm = document.createElement("form");

    hiddenForm.method = "POST";
    hiddenForm.action = endpoint;
    hiddenForm.target = bookingFrame.name;
    hiddenForm.hidden = true;

    const payload = {
      ...values,
      _iframe: "1"
    };

    Object.entries(payload).forEach(([name, value]) => {
      const input = document.createElement("input");

      input.type = "hidden";
      input.name = name;
      input.value = value;

      hiddenForm.appendChild(input);
    });

    document.body.appendChild(hiddenForm);

    bookingInProgress = true;
    setSubmitting(true);

    showStatus("Submitting your appointment request...");

    bookingTimeout = setTimeout(() => {
      if (!bookingInProgress) return;

      bookingInProgress = false;
      setSubmitting(false);

      showStatus(
        "We couldn't confirm the booking response. Check Google Calendar before attempting to book again.",
        "error"
      );

      hiddenForm.remove();
    }, 30000);

    try {
      hiddenForm.submit();
    } catch (error) {
      clearTimeout(bookingTimeout);
      bookingInProgress = false;
      setSubmitting(false);

      showStatus(
        "Unable to submit the appointment. Please try again.",
        "error"
      );
    }

    // Keep the temporary form briefly for browser compatibility.
    setTimeout(() => hiddenForm.remove(), 1000);
  }

  if (!dateInput || !timeSelect) {
    console.error(
      "Please add a date input and time select with names isoDate and time."
    );
    return;
  }

  configureDateInput();

  dateInput.addEventListener("change", () => {
    loadAvailability(dateInput.value);
  });

  form.addEventListener("submit", submitBooking);

  // If a date is already selected, load its availability.
  if (dateInput.value) {
    loadAvailability(dateInput.value);
  } else {
    setTimeOptions([], "Choose a date first");
  }
})();
