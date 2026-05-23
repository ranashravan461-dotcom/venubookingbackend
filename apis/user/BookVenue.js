const { ObjectId } = require("mongodb");
const connectDB = require("../../db/dbConnect");

async function BookVenue(req, res) {
  try {
    const { venue_id, booking_start_date, booking_end_date, booking_time } = req.body;

    if (!venue_id || !booking_start_date || !booking_end_date || !booking_time) {
      return res.status(400).json({
        success: false,
        message: "All fields required"
      });
    }

    const db = await connectDB();

    const startDate = new Date(booking_start_date);
    const endDate = new Date(booking_end_date);

    // ✅ CHECK AVAILABILITY
    const existingBooking = await db.collection("bookings").findOne({
      venue_id: new ObjectId(venue_id),
      booking_status: { $in: ["Pending", "Approved"] }, // important
      booking_time: booking_time,

      // 🔥 DATE OVERLAP LOGIC
      $or: [
        {
          booking_start_date: { $lte: endDate },
          booking_end_date: { $gte: startDate }
        }
      ]
    });

    // ❌ IF ALREADY BOOKED
    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "This venue is already booked for selected date & time"
      });
    }

    // ✅ IF AVAILABLE → INSERT
    const venue = await db.collection("venues").findOne({
      _id: new ObjectId(venue_id),
      status: "Active"
    });

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found"
      });
    }

    const rentalDays = Math.max(
      1,
      Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    );

    const total_amount = venue.price * rentalDays;

    await db.collection("bookings").insertOne({
      register_id: new ObjectId(req.user._id),
      venue_id: new ObjectId(venue_id),
      booking_start_date: startDate,
      booking_end_date: endDate,
      booking_time,
      total_amount,
      rental_days: rentalDays,
      booking_status: "Pending", // still admin approval
      payment_mode: "Online",
      payment_status: "Pending",
      created_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Booking request sent to admin"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

module.exports = { BookVenue };