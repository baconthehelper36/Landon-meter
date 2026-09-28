const webpush = require("web-push");

module.exports = async (req, res) => {
    if (req.method !== "POST" && req.method !== "GET") {
        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {
        const now = new Date();

        const hour = now.getHours();
        const minute = now.getMinutes();
        const day = now.getDay();

        let notification = null;

        // Monday = 1
        // Tuesday = 2
        // Wednesday = 3
        // Thursday = 4
        // Friday = 5

        // 5:50 AM - Breakfast
        if (hour === 5 && minute === 50) {
            notification = {
                recipient: "Landon",
                title: "Breakfast",
                body: "Did you eat breakfast yet?"
            };
        }

        // Monday 12:00 PM - Extracurricular reminder for Mama
        if (day === 1 && hour === 12 && minute === 0) {
            notification = {
                recipient: "mama",
                title: "Extracurricular Reminder",
                body: "Landon has extracurricular activities. Make sure he doesn't eat anything sour such as tomato sauce, etc."
            };
        }

        // Tuesday-Friday 12:00 PM - Lunch
        if (day >= 2 && day <= 5 && hour === 12 && minute === 0) {
            notification = {
                recipient: "Landon",
                title: "Lunch",
                body: "Did you eat lunch yet?"
            };
        }

        // 7:00 PM - Dinner
        if (hour === 19 && minute === 0) {
            notification = {
                recipient: "Landon",
                title: "Dinner",
                body: "Did you eat dinner yet?"
            };
        }

        if (!notification) {
            return res.status(200).json({
                sent: false,
                message: "No scheduled notification right now."
            });
        }

        console.log("Scheduled notification:", notification);

        return res.status(200).json({
            sent: true,
            notification
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Notification system error"
        });
    }
};
