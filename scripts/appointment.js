"use strict";

const CALENDAR_ID =
  "2bbe82282fdfe19aac198e1b42ee6237c02663bd3c6cf37ea77bab8c01d8cdcb@group.calendar.google.com";

const BUSINESS_TIMEZONE = "Australia/Sydney";
const APPOINTMENT_DURATION_MINUTES = 30;

const BUSINESS_SLOTS = [
  "9:00 AM",
  "9:30 AM",
  "10:30 AM",
  "11:00 AM",
  "1:00 PM",
  "2:30 PM",
  "3:30 PM",
  "4:00 PM"
];

// GET: health check and availability
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};

  if (params.action === "availability") {
    return getAvailability(params.date || "");
  }

  return jsonResponse({
    success: true,
    message: "SILAM Finance booking service is running."
  });
}

// POST: create a booking
function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    const data = getRequestData(e);

    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "isoDate",
      "time",
      "reason"
    ];

    for (const field of requiredFields) {
      if (
        typeof data[field] !== "string" ||
        !data[field].trim()
      ) {
        throw new Error("Please complete all required fields.");
      }
    }

    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim();
    const reason = data.reason.trim();
    const message = String(data.message || "").trim();

    if (
      firstName.length > 100 ||
      lastName.length > 100 ||
      phone.length > 40 ||
      reason.length > 200 ||
      message.length > 1000
    ) {
      throw new Error("One or more fields exceed the allowed length.");
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error("Please enter a valid email address.");
    }

    if (!BUSINESS_SLOTS.includes(data.time)) {
      throw new Error("Please select a valid appointment time.");
    }

    const calendar = getBookingCalendar();

    if (!lock.tryLock(15000)) {
      throw new Error(
        "The booking service is busy. Please try again shortly."
      );
    }

    lockAcquired = true;

    const startTime = parseAppointmentDate(
      data.isoDate,
      data.time
    );

    const endTime = new Date(
      startTime.getTime() +
      APPOINTMENT_DURATION_MINUTES * 60 * 1000
    );

    if (startTime.getTime() <= Date.now()) {
      throw new Error(
        "Please select a future appointment time."
      );
    }

    // Recheck availability while holding the lock.
    if (calendar.getEvents(startTime, endTime).length > 0) {
      throw new Error(
        "Sorry, this appointment has just been booked. Please choose another time."
      );
    }

    const customerName = `${firstName} ${lastName}`;

    const description = [
      `Customer: ${customerName}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Reason: ${reason}`,
      "",
      `Message: ${message || "None provided"}`,
      "",
      "Booked through the SILAM Finance website."
    ].join("\n");

    const event = calendar.createEvent(
      `SILAM Finance — ${customerName}`,
      startTime,
      endTime,
      {
        description: description,
        guests: email,
        sendInvites: true
      }
    );

    return jsonResponse({
      success: true,
      message: "Appointment successfully booked.",
      eventId: event.getId(),
      appointment: `${data.isoDate} · ${data.time}`,
      timezone: BUSINESS_TIMEZONE
    });

  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      message: error.message ||
        "Something went wrong while booking your appointment."
    });

  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

// Access the business calendar
function getBookingCalendar() {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);

  if (!calendar) {
    throw new Error(
      "SILAM Finance calendar could not be accessed. Check the calendar ID and permissions."
    );
  }

  return calendar;
}

// Return available slots for a selected date
function getAvailability(dateString) {
  try {
    if (!isValidDate(dateString)) {
      throw new Error("Please provide a valid date in YYYY-MM-DD format.");
    }

    const calendar = getBookingCalendar();
    const available = [];

    BUSINESS_SLOTS.forEach(function(time) {
      const startTime = parseAppointmentDate(dateString, time);

      const endTime = new Date(
        startTime.getTime() +
        APPOINTMENT_DURATION_MINUTES * 60 * 1000
      );

      // Do not offer appointments in the past.
      if (startTime.getTime() <= Date.now()) {
        return;
      }

      // Any overlapping event makes the slot unavailable.
      if (calendar.getEvents(startTime, endTime).length === 0) {
        available.push(time);
      }
    });

    return jsonResponse({
      success: true,
      date: dateString,
      timezone: BUSINESS_TIMEZONE,
      available: available
    });

  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      message: error.message ||
        "Unable to check availability."
    });
  }
}

// Parse either a JSON request or a standard form POST
function getRequestData(e) {
  if (!e) {
    throw new Error("No booking data was received.");
  }

  if (
    e.postData &&
    e.postData.type &&
    e.postData.type.toLowerCase().includes("application/json")
  ) {
    return JSON.parse(e.postData.contents || "{}");
  }

  return e.parameter || {};
}

// Validate that the date exists on the calendar
function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const parts = value.split("-").map(Number);

  const date = new Date(Date.UTC(
    parts[0],
    parts[1] - 1,
    parts[2]
  ));

  return (
    date.getUTCFullYear() === parts[0] &&
    date.getUTCMonth() === parts[1] - 1 &&
    date.getUTCDate() === parts[2]
  );
}

// Parse using the IANA time zone, including Sydney DST rules.
function parseAppointmentDate(dateString, timeString) {
  if (!isValidDate(dateString)) {
    throw new Error("Invalid appointment date.");
  }

  if (!BUSINESS_SLOTS.includes(timeString)) {
    throw new Error("Invalid appointment time.");
  }

  const appointment = Utilities.parseDate(
    `${dateString} ${timeString}`,
    BUSINESS_TIMEZONE,
    "yyyy-MM-dd h:mm a"
  );

  // Round-trip validation catches dates/times that do not
  // parse back to the requested local calendar time.
  const roundTrip = Utilities.formatDate(
    appointment,
    BUSINESS_TIMEZONE,
    "yyyy-MM-dd h:mm a"
  );

  if (roundTrip !== `${dateString} ${timeString}`) {
    throw new Error(
      "This appointment time is invalid for the selected date."
    );
  }

  return appointment;
}

// JSON output for the web app
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run manually in Apps Script to test calendar access.
function testCalendarAccess() {
  const calendar = getBookingCalendar();

  Logger.log("Calendar name: " + calendar.getName());
  Logger.log("Calendar timezone: " + calendar.getTimeZone());

  const testDate = new Date();
  const events = calendar.getEventsForDay(testDate);

  Logger.log("Events found today: " + events.length);
}
